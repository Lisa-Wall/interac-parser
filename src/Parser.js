/**
 * Interac email parser. 
 * Parses an email object sent by Interac and returns a JSON object representing the data.
 * 
 * Input: A raw email (RFC 5322) that has been parsed using MailParser. 
 *        MailParser is part of the node package mailparser. (https://nodemailer.com/extras/mailparser/).
 * 
 * @class
 * @author Lisa Wall <lisac@live.ca>
 */
export default class Parser
{
    static version = "2.0";

    /**
     * 
     * @param {@mailparser.mail} email 
     */
    static parse(email)
    {
        // Parse the required data.
        const to      = this.getRecipient(email, "to");
        const from    = this.getRecipient(email, "from");
        const replyTo = this.getRecipient(email, "replyTo");

        const body    = this.parseBody(email.text);
        const subject = this.parseSubject(email.subject);
        const errors  = [];

        // Do some validation.
        if (!subject.is_email_transfer)                         errors.push(`Subject does not start with 'INTERAC e-Transfer'.`);
        if (!body.is_valid_amount)                              errors.push(`Amount is not a valid number: ${body.amount}`);
        if (subject.language !== body.language)                 errors.push(`Subject and body language does not match.`);
        if (subject.is_auto_deposit !== body.is_auto_deposit)   errors.push(`Subject and body auto-deposit does not match.`);

        // Build the result.
        const result = {
            version                 : this.version,
            uid                     : email.uid,
            serverId                : email.server_id,

            messageId               : email.messageId,
            date                    : new Date(email.date),

            toName                  : to.name,
            toEmail                 : to.email,
            fromName                : from.name,
            fromEmail               : from.email,
            replyToName             : replyTo.name,
            replyToEmail            : replyTo.email,

            language                : body.language || subject.language,
            amount                  : body.amount,
            currency                : body.currency,
            reference               : body.reference,
            isAutoDeposit           : (body.is_auto_deposit && subject.is_auto_deposit),
            userMessage             : body.message,

            isEmailTransfer         : (subject.is_email_transfer && body.is_valid_amount),

            body                    : body.text,
            subject                 : subject.text,

            errors                  : (errors.length ? errors : null)
        };

        return result;
    }

    /**
     * Extracts the recipient's name and email address.
     * 
     * @param {@mailparser.mail} email - A MailParser object, as defined at https://nodemailer.com/extras/mailparser/
     * @param {string} type - Either "to" "from", or "replyTo"
     * 
     * @returns {Object} - Returns an object in the format {name, email}
     */
    static getRecipient(email, type)
    {
        const value = (email && email[type] && Array.isArray(email[type].value) ? email[type].value[0] : null);
        return { name: (value ? value.name : null), email: (value ? value.address : null) };
    }

    /**
     * Parses the body of the email message to extract the relevant data.
     * 
     * @param {string} bodyText - the plaintext body of the message
     */
    static parseBody(bodyText)
    {
        // Strip the email into lines, remove unused lines and trim them.
        const lines = bodyText.split('\n').map( line=>line.trim() ).filter( line=>(line.length > 0));
        const text = lines.join('\n');

        let body = {text, language: null, amount: null, currency: null, is_auto_deposit: null, message: null, reference: null, is_valid_amount: false};

        // Determine the language. Separate the first line of words and clean it up.
        body.language = this.tokenStarts(text.toLowerCase(), "body_greetings");

        // Determine if it has been auto deposited.
        body.is_auto_deposit = !!this.tokenExists(text.toLowerCase(), "automatic_deposit");

        // Get the sender's name.
        const fromLine = lines[1];
        body.from_name = this.readUpperCase(fromLine);

        // Find the line with the message if there is any.
        const messageLine = this.tokenStartsLine(lines, "message");
        if (messageLine) body.message = this.readAfter(messageLine, ':');

        // Find the line with the reference number.
        const referenceLine = this.tokenStartsLine(lines, "reference");
        if (referenceLine) body.reference = this.readAfter(referenceLine, ':');

        // Find the line that contains the dollar value.
        const line = this.containsLine(lines, '$');
        if (!line) return body;

        // Get the amount, find the first number then read until the space. 
        // If french then replace ',' with '.' otherwise replace ',' with ''
        const amountStart = line.indexOf('$');
        const amountEnd = line.indexOf(' ', amountStart);
        if (amountStart !== -1 && amountEnd !== -1)
        {
            const amount = line.substring(amountStart + 1, amountEnd).trim().replace(/,/g, '');
            body.amount = Number.parseFloat( amount );
        }

        // If not found then use a different strategy, look for the first number in the same line as '$'
        if (isNaN(body.amount))
        {
            const digitStart = line.search(/\d/);
            const digitEnd = line.indexOf(' ', digitStart);
            if (digitStart !== -1 && digitEnd !== -1) body.amount = Number.parseFloat( line.substring(digitStart, digitEnd).trim().replace(/,/g, '.') );
        }

        // Check the amount.
        body.is_valid_amount = (typeof(body.amount) === "number" && !Number.isNaN(body.amount));

        // Get the currency
        const currencyStart = line.indexOf('(');
        const currencyEnd = line.indexOf(')', currencyStart);
        if (currencyStart !== -1 && currencyEnd !== -1 && (currencyEnd - currencyStart) >= 3) body.currency = line.substring(currencyStart + 1, currencyEnd);

        // Return success;
        return body;
    }

    /**
     * Parse the subject of the email message. 
     * This is used to validate the body to make sure we got everything successfully.
     * 
     * @param {string} text
     */
    static parseSubject(text)
    {
        const subject = {text, language: null, is_email_transfer: null, is_auto_deposit: null }

        // Convert text to lower case to find stuff more easily.
        text = text.toLowerCase();

        // Determine the language based on the first words.
        subject.language = this.tokenStarts(text, "subject_start");

        // If the language was a match then starts with the expected string.
        subject.is_email_transfer = !!subject.language;

        // Check if there is an autodeposit message in the subject.
        subject.is_auto_deposit = !!this.tokenExists(text, "automatic_deposit");

        // Return the subject details.
        return subject;
    }

    /**
     * Determines if the given token exists within the text, regardless of language.
     * 
     * @param {string} text 
     * @param {string} token 
     */
    static tokenExists(text, token)
    {
        for (let language in Tokens) if (text.indexOf(Tokens[language][token]) !== -1) return language;
        return null;
    }

    /**
     * Determines if the given text starts with the given token.
     * @param {string} text 
     * @param {string} token 
     */
    static tokenStarts(text, token)
    {
        for (let language in Tokens) if (text.startsWith(Tokens[language][token])) return language;
        return null;
    }

    /**
     * Returns the line of text that begins with the given token.
     * 
     * @param {string} lines 
     * @param {string} token 
     */
    static tokenStartsLine(lines, token)
    {
        for (let language in Tokens)
        {
            const langToken = Tokens[language][token];
            for (let index = 0; index < lines.length; index++) if (lines[index].toLowerCase().startsWith(langToken)) return lines[index];
        }

        return null;
    }

    /**
     * Reads all uppercase characters, including spaces, until it reaches a non-uppercase or non-character.
     * 
     * @param {string} line 
     */
    static readUpperCase(line)
    {
        let index = 0;
        while (index < line.length)
        {
            const char = line[index];
            if (char !== char.toUpperCase()) break;
            else index++;
        }

        return line.substring(0, index - 1).trim();
    }

    /**
     * Returns the line of text that contains the given token.
     * 
     * @param {string} lines 
     * @param {string} token 
     */
    static containsLine(lines, token)
    {
        for (let line of lines) if (line.indexOf(token) !== -1) return line;
        return null;
    }

    /**
     * Returns eventhing after the given token.
     * 
     * @param {string} text 
     * @param {string} token 
     * @param {object} [options]
     * @param {boolean} [options.trim = true] - Trims the extracted string
     */
    static readAfter(text, token, options)
    {
        options = Object.assign({trim: true}, options);

        const index = text.indexOf(token);
        if (index === -1) return null;

        let value = text.substring(index + token.length, text.length);

        if (options.trim) value = value.trim();

        return value;
    }
}


const Tokens = {
    en: {
        "body_greetings"        : "hi",
        "message"               : "message",
        "reference"             : "reference",
        "subject_start"         : "interac e-transfer",
        "automatic_deposit"     : "automatically deposited",
        "sent"                  : "has sent"
    },
    fr: {
        "body_greetings"        : "bonjour",
        "message"               : "message",
        "reference"             : "référence",
        "subject_start"         : "virement interac",
        "automatic_deposit"     : "automatiquement",
        "sent"                  : "vous"
    }
}

