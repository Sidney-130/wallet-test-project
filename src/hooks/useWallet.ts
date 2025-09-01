"use client";

import { useState, useCallback, useEffect } from "react";
import Web3 from "web3";
import type { WalletState } from "@/types/wallet";

export const useWallet = () => {
  const [walletState, setWalletState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    chainId: null,
    balance: null,
  });

  // ✅ Implement MetaMask detection
  const isMetamaskInstalled =
    typeof window !== "undefined" && typeof window.ethereum !== "undefined";

  // ✅ NEW: helper to create a Web3 instance
  const getWeb3 = useCallback(() => {
    if (typeof window === "undefined" || !window.ethereum) return null;
    return new Web3(window.ethereum);
  }, []);

  // ✅ Implement wallet connection
  const connect = useCallback(async () => {
    try {
      // 1. Check if MetaMask is installed using getWeb3() instead of direct check
      if (!window.ethereum) {
        setWalletState((prev) => ({
          ...prev,
          error: "MetaMask is not installed. Please install it.",
        }));
        return;
      }

      // 2. Request account access using eth_requestAccounts (always triggers popup)
      setWalletState((prev) => ({ ...prev, isConnecting: true, error: null }));

      // Force MetaMask popup by first checking if already connected, then requesting fresh connection
      try {
        // Always use eth_requestAccounts to force popup (never use eth_accounts for connect)
        const accounts = (await window.ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];

        if (!accounts || accounts.length === 0) {
          setWalletState((prev) => ({
            ...prev,
            isConnecting: false,
            error: "No accounts found or user rejected connection",
          }));
          return;
        }

        const address = accounts[0];

        // Create fresh Web3 instance after connection
        const web3 = new Web3(window.ethereum);

        // 3. Get account address and chain ID
        const chainId = await web3.eth.getChainId();

        // 4. Get account balance in ETH
        const balanceWei = await web3.eth.getBalance(address);
        const balanceEth = web3.utils.fromWei(balanceWei, "ether");

        // 5. Update wallet state
        setWalletState({
          address,
          isConnected: true,
          isConnecting: false,
          error: null,
          chainId: String(chainId),
          balance: Number.parseFloat(balanceEth).toFixed(4),
        });

        // ✅ Save connection flag to localStorage (for refresh auto-reconnect only)
        localStorage.setItem("isWalletConnected", "true");
      } catch (requestError) {
        // Handle user rejection or other MetaMask errors
        const errorMessage =
          requestError instanceof Error
            ? requestError.message
            : "User rejected connection";
        setWalletState((prev) => ({
          ...prev,
          isConnecting: false,
          error: errorMessage.includes("User rejected")
            ? "Connection rejected by user"
            : errorMessage,
        }));
      }
    } catch (err) {
      // 6. Handle errors gracefully
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setWalletState((prev) => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        error: errorMessage,
      }));
    }
  }, []);

  // ✅ Implement wallet disconnection
  const disconnect = useCallback(() => {
    console.log("Disconnecting wallet...");

    // Reset wallet state to initial values
    setWalletState({
      address: null,
      isConnected: false,
      isConnecting: false,
      error: null,
      chainId: null,
      balance: null,
    });

    // ✅ Clear all possible stored data
    localStorage.removeItem("isWalletConnected");
    sessionStorage.clear();

    // Clear any cached Web3 instances and try to revoke permissions
    if (window.ethereum) {
      // Force MetaMask to show popup on next connect by clearing any cached permissions
      window.ethereum
        .request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        })
        .catch(() => {
          // Ignore errors - this method might not be supported in all MetaMask versions
        });
    }

    console.log("Wallet disconnected successfully - cleared all cached data");
  }, []);

  // ✅ Auto-reconnect on page refresh if previously connected
  useEffect(() => {
    const shouldReconnect = localStorage.getItem("isWalletConnected");
    if (shouldReconnect === "true") {
      (async () => {
        const web3 = getWeb3();
        if (!web3) return;

        try {
          const accounts = (await window.ethereum.request({
            method: "eth_accounts",
          })) as string[];

          if (accounts.length > 0) {
            const address = accounts[0];
            const chainId = await web3.eth.getChainId();
            const balanceWei = await web3.eth.getBalance(address);
            const balanceEth = web3.utils.fromWei(balanceWei, "ether");

            setWalletState({
              address,
              isConnected: true,
              isConnecting: false,
              error: null,
              chainId: String(chainId),
              balance: Number.parseFloat(balanceEth).toFixed(4),
            });
          }
        } catch (error) {
          // Auto-reconnect failed, clear the flag
          localStorage.removeItem("isWalletConnected");
        }
      })();
    }
  }, [getWeb3]);

  // ✅ NEW: If the tab is closed, remove connection flag (so reopening tab won't auto-connect)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // ✅ Detect if this is a refresh vs full tab close
      const navEntries = performance.getEntriesByType(
        "navigation"
      ) as PerformanceNavigationTiming[];
      const navType = navEntries[0]?.type;

      if (navType === "reload") {
        // Refresh → keep localStorage so auto-reconnect works
        return;
      }

      // Tab closed → clear storage
      localStorage.removeItem("isWalletConnected");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // ✅ Handle account and network changes in MetaMask
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      console.log("Account changed:", accounts);
      if (accounts.length === 0) {
        disconnect();
      } else {
        try {
          // Create fresh Web3 instance for account change
          const web3 = new Web3(window.ethereum);
          const address = accounts[0];
          const chainId = await web3.eth.getChainId();
          const balanceWei = await web3.eth.getBalance(address);
          const balanceEth = web3.utils.fromWei(balanceWei, "ether");

          setWalletState((prev) => ({
            ...prev,
            address,
            isConnected: true,
            chainId: String(chainId),
            balance: Number.parseFloat(balanceEth).toFixed(4),
            error: null,
          }));
        } catch (error) {
          console.error("Error handling account change:", error);
          setWalletState((prev) => ({
            ...prev,
            error: "Failed to update account information",
          }));
        }
      }
    };

    const handleChainChanged = async (chainIdHex: string) => {
      console.log("🔄 Network changed detected:", chainIdHex);

      // Only update if wallet is currently connected
      if (!walletState.isConnected) {
        console.log("⚠️ Wallet not connected, ignoring chain change");
        return;
      }

      try {
        const chainId = parseInt(chainIdHex, 16).toString();
        console.log("📡 Updating to chain ID:", chainId);

        // Create fresh Web3 instance for network change
        const web3 = new Web3(window.ethereum);

        const accounts = (await window.ethereum.request({
          method: "eth_accounts",
        })) as string[];

        if (accounts.length > 0) {
          const address = accounts[0];
          console.log("💰 Getting balance for address:", address);

          const balanceWei = await web3.eth.getBalance(address);
          const balanceEth = web3.utils.fromWei(balanceWei, "ether");
          const formattedBalance = Number.parseFloat(balanceEth).toFixed(4);

          console.log("✅ Network update complete:", {
            chainId,
            balance: formattedBalance,
          });

          setWalletState((prev) => ({
            ...prev,
            chainId,
            address,
            isConnected: true,
            balance: formattedBalance,
            error: null,
          }));
        } else {
          console.log("❌ No accounts found after network change");
          disconnect();
        }
      } catch (error) {
        console.error("❌ Error handling network change:", error);
        setWalletState((prev) => ({
          ...prev,
          error: "Failed to update network information",
        }));
      }
    };

    const handleDisconnect = () => {
      console.log("MetaMask disconnected");
      disconnect();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("disconnect", handleDisconnect);

    return () => {    
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
        window.ethereum.removeListener("chainChanged", handleChainChanged);
        window.ethereum.removeListener("disconnect", handleDisconnect);
      }
    };
  }, [disconnect, walletState.isConnected]);

  return {
    ...walletState,
    isMetamaskInstalled,
    connect,
    disconnect,
  };
};
