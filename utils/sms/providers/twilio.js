import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

export const sendWhatsAppOTP = async (phoneNumber, message) => {
  console.log("🔥 INSIDE sendWhatsAppOTP");

  const result = await client.messages.create({
    from: "whatsapp:+14155238886",

    to: `whatsapp:${phoneNumber}`,
    body: message,
  });

  console.log("📨 WhatsApp SID:", result.sid);
  return result;
};

export const sendViaTwilio = async (phoneNumber, message) => {
  try {
    const result = await client.messages.create({
      to: `+91${phoneNumber}`, // Assuming Indian numbers, adjust country code as needed
      from: twilioPhoneNumber,
      body: message,
    });
    console.log("SMS sent:", result.sid);
    return result;
  } catch (error) {
    console.error("Error sending SMS:", error);
    throw new Error("Failed to send SMS");
  }
};
