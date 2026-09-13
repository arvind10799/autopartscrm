export type AppConnectMatchedContact = {
  id: string;
  name: string;
  phone: string;
  type: 'order' | 'lead';
  additionalInfo: Record<string, string>;
};

export type AppConnectFindContactResponse = {
  successful: boolean;
  matchedContactInfo: AppConnectMatchedContact[];
};

export type AppConnectAuthenticationResponse = {
  user: {
    username: string;
  };
  message: string;
};
