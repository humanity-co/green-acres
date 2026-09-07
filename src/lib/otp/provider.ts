export interface OtpProvider {
  request(phone: string, code: string): Promise<void>;
}

export const mockProvider: OtpProvider = {
  async request(phone, code) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Mock OTP forbidden in production");
    }
    if (process.env.MOCK_OTP_ENABLED !== "true") {
      throw new Error("Mock OTP disabled");
    }
    console.log(`[MOCK OTP] ${phone} OTP generated (code: ${code})`);
  },
};

export const msg91Provider: OtpProvider = {
  async request(phone, code) {
    const key = process.env.MSG91_AUTH_KEY;
    if (!key) throw new Error("MSG91_AUTH_KEY missing");
    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: key },
      body: JSON.stringify({ mobile: phone, otp: code }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MSG91 OTP delivery failed: ${err}`);
    }
  },
};

export const twilioProvider: OtpProvider = {
  async request(phone, code) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("Twilio SMS credentials missing: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER must be configured");
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const params = new URLSearchParams();
    params.append("To", phone);
    params.append("From", fromNumber);
    params.append("Body", `Your Society OS verification code is ${code}. Valid for 5 minutes.`);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twilio SMS delivery failed: ${err}`);
    }
  },
};

export function getOtpProvider(): OtpProvider {
  const p = process.env.OTP_PROVIDER || "mock";
  if (p === "msg91") return msg91Provider;
  if (p === "twilio") return twilioProvider;
  return mockProvider;
}
