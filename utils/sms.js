import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

export const sendSMS = async (to, message) => {
  try {
    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: `+91${to}`, // Assuming Indian numbers, adjust country code as needed
    });
    console.log('SMS sent:', result.sid);
    return result;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw new Error('Failed to send SMS');
  }
};