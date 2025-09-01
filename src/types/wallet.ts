export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  chainId: string | null;
  balance: string | null;
}

export interface MetamaskError {
  code: number;
  message: string;
}

export type WalletAction = 
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS'; address: string; chainId: string }
  | { type: 'CONNECT_ERROR'; error: string }
  | { type: 'DISCONNECT' }
  | { type: 'UPDATE_BALANCE'; balance: string };

export interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
