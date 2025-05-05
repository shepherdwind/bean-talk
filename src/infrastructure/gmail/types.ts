export interface GmailCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export interface GmailTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface Email {
  id: string;
  to: string;
  subject: string;
  from: string;
  date?: string;
  body: string;
} 