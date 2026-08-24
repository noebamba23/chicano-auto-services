// Abstraction générique de canal de messagerie sortant (section 9 du prompt
// maître). WhatsAppProvider en est une spécialisation — un futur canal SMS
// ou email transactionnel implémenterait la même interface.

export interface MessageSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface MessagingProvider {
  readonly name: string;
  sendText(to: string, body: string): Promise<MessageSendResult>;
}
