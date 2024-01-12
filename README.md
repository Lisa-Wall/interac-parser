# interac-parser
A parser that takes an email object sent by Interac and returns a JSON object representing the data.

# Purpose

Having an object representing an Interac email is useful for many things, particularly to respond to a customer's eTransfer in an automated way.

The first thing I will be using this parser for is to provide automated rent receipts to our tenants. That component will also be posted on GitHub shortly.

# Input

A raw email (RFC 5322) that has been parsed using MailParser. MailParser is part of the node package mailparser. (https://nodemailer.com/extras/mailparser/). 

# Process
Traverse the fields of the MailParser object, pull out the relevant fields, do some validation, and build the result object.

For this implementation, I'm not interested in all email fields; just the ones relevant to payments, recipients, auto-deposit, language etc. See the sample output below.

# Output

A JSON object representing the Interac data. Example:

```JavaScript

{
  version: '2.0',
  uid: undefined,
  serverId: undefined,
  messageId: '<1569034797.175709886.1598538700364.JavaMail.app_prod@mtlpnot04.prod.certapay.com>',
  date: 2024-01-05T14:31:40.000Z,
  toName: 'SAMPLE LANDLORD',
  toEmail: 'addmoney@landlord_company.ca',
  fromName: 'SAMPLE TENANT',
  fromEmail: 'catch@payments.interac.ca',
  replyToName: 'SAMPLE TENANT',
  replyToEmail: 'sample.tenant@gmail.com',
  language: 'en',
  amount: 5.25,
  currency: 'CAD',
  reference: 'CAvjMTys',
  isAutoDeposit: true,
  userMessage: '((UON5-CHCZ-22RH-F0N6))',
  isEmailTransfer: true,
  body: 'Hi SAMPLE LANDLORD,\n' +
    'SAMPLE TENANT has sent you a money transfer for the amount of $5.25 (CAD) and the money has been automatically deposited into your bank account at Scotiabank.\n' +
    'Message: ((UON5-CHCZ-22RH-F0N6))\n' +
    'Reference Number : CAvjMTys\n' +
    'Please do not reply to this email.\n' +
    'Frequently Asked Questions: http://www.interac.ca/consumers/faqs.php#emt\n' +
    'This email was sent to you by Interac Corp., the owner of the INTERAC e-Transfer®\n' +
    'service, on behalf of Scotiabank.\n' +
    'Interac Corp.\n' +
    'Royal Bank Plaza, North Tower, 200 Bay Street, Suite 2400\n' +
    'P.O. Box 45, Toronto, ON M5J 2J1\n' +
    'www.interac.ca\n' +
    '® Trade-mark of Interac Corp. Used under license.',
  subject: 'INTERAC e-Transfer: A money transfer from SAMPLE TENANT has been automatically deposited.',
  errors: null
}
```