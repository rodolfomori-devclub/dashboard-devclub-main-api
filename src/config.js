import 'dotenv/config';

export const config = {
  token: process.env.DMG_TOKEN,
  port: process.env.PORT || 3000
};