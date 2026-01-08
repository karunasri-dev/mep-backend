import { sendViaTwilio, sendWhatsAppOTP } from "./providers/twilio.js";

import { sendViaFast2SMS } from "./providers/fast2sms.js";

export const sendOTP = async ({ phoneNumber, otp }) => {
  if (!phoneNumber || !otp) {
    throw new Error("phoneNumber and otp required");
  }

  // India-first strategy
  await sendViaFast2SMS({
    phoneNumber,
    otp,
  });

  return { provider: "fast2sms" };
};

// export const sendOTP = async ({ phoneNumber, message }) => {
//   console.log("🔥 sendOTP EXECUTING");

//   console.log("➡️ calling sendWhatsAppOTP");
//   const res = await sendWhatsAppOTP(phoneNumber, message);

//   console.log("✅ WhatsApp provider executed");
//   return res;
// };

// export const sendOTP = async ({ phoneNumber, message }) => {
//   console.log("sendOTP called with:", phoneNumber, message);
//   if (!phoneNumber || !message) {
//     throw new Error("phoneNumber and message required");
//   }

// Indian numbers → try Fast2SMS first
// if (isIndianNumber(phoneNumber)) {
//   try {
//     await withTimeout(sendViaFast2SMS({ to: phoneNumber, message }), 5000);
//     return { provider: "fast2sms" };
//   } catch (err) {
//     console.warn("Fast2SMS failed, falling back to Twilio", err.message);
//   }
// }

// Fallback / non-Indian numbers
// await sendWhatsAppOTP(phoneNumber, message);
//   console.log("SMS sent");

//   // await withTimeout(sendViaTwilio({ to: phoneNumber, message }), 5000);
//   return { provider: "twilio" };
// };

const withTimeout = (promise, ms = 5000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("SMS timeout")), ms)
    ),
  ]);
