import "dotenv/config";

export const getEnvVariable = (key: string): string => {
  const value = process.env[key];
  if (value !== undefined) {
    return value;
  } else {
    throw new Error(`${key} not set in environment variables`);
  }
};
