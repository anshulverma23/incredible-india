const { z } = require("zod");
const { password, email } = require("./common");

const register = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email,
  password,
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,18}$/, "Invalid phone number").optional().or(z.literal("")),
});

const login = z.object({ email, password: z.string().min(1, "Password is required").max(72) });
const forgotPassword = z.object({ email });
const resetPassword = z.object({ password });
const changePassword = z.object({ currentPassword: z.string().min(1, "Current password is required"), newPassword: password });
const google = z.object({ idToken: z.string().min(10) });

module.exports = { register, login, forgotPassword, resetPassword, changePassword, google };
