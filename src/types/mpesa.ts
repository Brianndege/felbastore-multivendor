export interface MpesaSTKPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: string;
  Amount: number;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

export interface MpesaSTKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface MpesaCallbackMetadataItem {
  Name: string;
  Value?: string | number;
}

export interface MpesaCallbackMetadata {
  Item: MpesaCallbackMetadataItem[];
}

export interface MpesaSTKCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: MpesaCallbackMetadata;
}

export interface MpesaCallbackBody {
  stkCallback: MpesaSTKCallback;
}

export interface MpesaCallback {
  Body: MpesaCallbackBody;
}

export interface MpesaQueryRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  CheckoutRequestID: string;
}

export interface MpesaQueryResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
  MpesaReceiptNumber?: string;
}

export interface MpesaAccessTokenResponse {
  access_token: string;
  expires_in: string;
}

export interface MpesaInitiateRequest {
  orderId: string;
  phoneNumber: string;
  amount: number;
}

export interface MpesaInitiateResponse {
  success: boolean;
  checkoutRequestId?: string;
  message: string;
}
