import axios from "axios";

export const sendViaFast2SMS = async ({ phoneNumber, otp }) => {
  try {
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        route: "otp",
        variables_values: otp,
        numbers: phoneNumber.replace("+91", ""),
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );

    // IMPORTANT: log provider response (not OTP)
    console.log("Fast2SMS response:", response.data);

    if (!response.data.return) {
      throw new Error("Fast2SMS delivery failed");
    }

    return response.data;
  } catch (err) {
    console.error("Fast2SMS error:", err.response?.data || err.message);
    throw err;
  }
};
