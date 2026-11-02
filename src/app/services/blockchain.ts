import { Injectable } from '@angular/core';
import { ethers } from 'ethers';

export interface TransactionRecord {
  type: 'faucet' | 'send' | 'receive';
  from: string;
  to: string;
  amount: string;
  hash: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class BlockchainService {
  private provider: any;
  private signer: any;
  private contract: any;
  
  private contractAddress = "0xd60Fc9E22A8A5644A63F5cdc4EC4882Cd96876A8";
  
  private contractABI: any = [
    {
      "anonymous": false,
      "inputs": [
        { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
        { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
        { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
      ],
      "name": "Transfer",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "requestFaucet",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "address", "name": "to", "type": "address" },
        { "internalType": "uint256", "name": "value", "type": "uint256" }
      ],
      "name": "transfer",
      "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
      "name": "balanceOf",
      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
      "name": "lastFaucetClaim",
      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    }
  ];

  async connectWallet(): Promise<string> {
    if ((window as any).ethereum) {
      try {
        // Force l'affichage de la fenêtre de sélection de compte MetaMask à chaque appel
        await (window as any).ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }]
        });
      } catch (err) {
        console.warn("Demande de permission annulée par l'utilisateur");
      }

      // Récupère le compte sélectionné
      await (window as any).ethereum.request({
        method: "eth_requestAccounts"
      });

      this.provider = new ethers.BrowserProvider((window as any).ethereum);
      this.signer = await this.provider.getSigner();
      this.contract = new ethers.Contract(this.contractAddress, this.contractABI, this.signer);
      
      return await this.signer.getAddress();
    } else {
      throw new Error("MetaMask n'est pas installé !");
    }
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.contract.balanceOf(address);
    return ethers.formatEther(balance);
  }

  async canClaimFaucet(userAddress: string): Promise<{ canClaim: boolean; timeLeft: number }> {
    if (!this.contract) return { canClaim: true, timeLeft: 0 };
    try {
      const lastClaim = await this.contract.lastFaucetClaim(userAddress);
      const now = Math.floor(Date.now() / 1000);
      const cooldown = 120; // 2 minutes
      const elapsed = now - Number(lastClaim);

      if (elapsed < cooldown) {
        return { canClaim: false, timeLeft: cooldown - elapsed };
      }
      return { canClaim: true, timeLeft: 0 };
    } catch (e) {
      return { canClaim: true, timeLeft: 0 };
    }
  }

  async requestFaucet(): Promise<any> {
    const tx = await this.contract.requestFaucet();
    return await tx.wait();
  }

  async transferTokens(toAddress: string, amount: string | number): Promise<any> {
    const stringAmount = String(amount);
    const parsedAmount = ethers.parseEther(stringAmount);
    const tx = await this.contract.transfer(toAddress, parsedAmount);
    return await tx.wait();
  }

  async getTransactionHistory(userAddress: string): Promise<TransactionRecord[]> {
    if (!this.contract || !this.provider) return [];
    try {
      const filterFrom = this.contract.filters.Transfer(userAddress, null);
      const filterTo = this.contract.filters.Transfer(null, userAddress);
      
      const logsFrom = await this.contract.queryFilter(filterFrom, -1000);
      const logsTo = await this.contract.queryFilter(filterTo, -1000);
      
      const allLogs = [...logsFrom, ...logsTo];
      const transactions: TransactionRecord[] = [];

      for (const log of allLogs) {
        const event = log as any;
        const from = event.args[0];
        const to = event.args[1];
        const value = ethers.formatEther(event.args[2]);
        
        let type: 'faucet' | 'send' | 'receive' = 'send';
        if (from === '0x0000000000000000000000000000000000000000') {
          type = 'faucet';
        } else if (to.toLowerCase() === userAddress.toLowerCase()) {
          type = 'receive';
        }

        transactions.push({
          type,
          from,
          to,
          amount: value,
          hash: event.transactionHash,
          timestamp: new Date().toLocaleTimeString()
        });
      }

      return transactions.reverse();
    } catch (e) {
      return [];
    }
  }
}