import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlockchainService, TransactionRecord } from './services/blockchain';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  walletAddress: string = '';
  balance: string = '0';
  transactions: TransactionRecord[] = [];
  activeTab: string = 'dashboard';

  // Gestion du nom du compte et des détails de transaction
  accountName: string = 'Étudiant UNIKIN';
  selectedTransaction: TransactionRecord | null = null;
  showAllActivitiesModal: boolean = false;

  lastResult: { title: string; hash: string; amount: string; type: string } | null = null;

  showAccountModal: boolean = false;
  manualAddressInput: string = '';

  studentName: string = '';
  studentMatricule: string = '';
  studentLevel: string = 'Master 1 Informatique';
  isRegistered: boolean = false;

  recipientAddress: string = '';
  transferAmount: string = '';

  notification: { message: string; type: 'success' | 'error' | 'info' } | null = null;

  constructor(private blockchainService: BlockchainService) {}

  showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.notification = { message, type };
    setTimeout(() => {
      this.notification = null;
    }, 6000);
  }

  async connect() {
    try {
      this.walletAddress = await this.blockchainService.connectWallet();
      await this.onAccountSwitched();
      this.showNotification('Portefeuille MetaMask connecté avec succès !', 'success');
    } catch (err: any) {
      this.showNotification(err.message, 'error');
    }
  }

  openAccountModal() {
    this.manualAddressInput = this.walletAddress;
    this.showAccountModal = true;
  }

  closeAccountModal() {
    this.showAccountModal = false;
  }

  async applyManualAddress() {
    if (!this.manualAddressInput || !this.manualAddressInput.startsWith('0x')) {
      this.showNotification("Veuillez entrer une adresse valide (0x...).", 'error');
      return;
    }

    try {
      this.walletAddress = this.manualAddressInput.trim();
      await this.onAccountSwitched();
      this.closeAccountModal();
      this.showNotification(`Compte basculé vers : ${this.walletAddress.substring(0, 8)}...`, 'success');
    } catch (err: any) {
      this.showNotification("Erreur lors du chargement du compte.", 'error');
    }
  }

  async connectMetaMaskAccount() {
    try {
      this.walletAddress = await this.blockchainService.connectWallet();
      await this.onAccountSwitched();
      this.closeAccountModal();
      this.showNotification('Compte MetaMask sélectionné avec succès !', 'success');
    } catch (err: any) {
      this.showNotification(err.message, 'error');
    }
  }

  async onAccountSwitched() {
    this.lastResult = null;
    this.loadProfileForCurrentAccount();
    await this.refreshData();
  }

  loadProfileForCurrentAccount() {
    const savedProfile = localStorage.getItem(`profile_${this.walletAddress}`);
    if (savedProfile) {
      const profile = JSON.parse(savedProfile);
      this.studentName = profile.name;
      this.studentMatricule = profile.matricule;
      this.studentLevel = profile.level;
      this.accountName = profile.name; // Met à jour le nom du compte affiché
      this.isRegistered = true;
    } else {
      this.studentName = '';
      this.studentMatricule = '';
      this.studentLevel = 'Master 1 Informatique';
      this.accountName = `Compte (${this.walletAddress.substring(0, 6)}...)`;
      this.isRegistered = false;
    }
  }

  async refreshData() {
    this.balance = await this.blockchainService.getBalance(this.walletAddress);
    this.transactions = await this.blockchainService.getTransactionHistory(this.walletAddress);
  }

  getBarHeight(amountStr: string): string {
    const amt = parseFloat(amountStr) || 0;
    return `${Math.min(Math.max(amt * 5, 20), 100)}%`;
  }

  // Ouvre les détails d'une transaction spécifique au clic
  openTransactionDetails(tx: TransactionRecord) {
    this.selectedTransaction = tx;
  }

  closeTransactionDetails() {
    this.selectedTransaction = null;
  }

  switchTab(tab: string) {
    this.activeTab = tab;
  }

  registerStudent() {
    if (!this.studentName || !this.studentMatricule) {
      this.showNotification('Veuillez remplir tous les champs.', 'error');
      return;
    }
    
    const profile = {
      name: this.studentName,
      matricule: this.studentMatricule,
      level: this.studentLevel
    };
    localStorage.setItem(`profile_${this.walletAddress}`, JSON.stringify(profile));
    this.accountName = this.studentName;

    this.isRegistered = true;
    this.showNotification('Profil étudiant enregistré pour ce compte !', 'success');
  }

  async claimFaucet() {
    try {
      const check = await this.blockchainService.canClaimFaucet(this.walletAddress);
      if (!check.canClaim) {
        const minutes = Math.floor(check.timeLeft / 60);
        const seconds = check.timeLeft % 60;
        this.showNotification(`Veuillez patienter encore ${minutes}m ${seconds}s avant la prochaine réclamation.`, 'error');
        return;
      }

      this.showNotification('Transaction Faucet envoyée. Veuillez valider dans MetaMask...', 'info');
      const tx = await this.blockchainService.requestFaucet();
      await this.refreshData();
      
      this.lastResult = {
        title: 'Faucet Fait avec Succès !',
        hash: tx.hash,
        amount: '10 UKT',
        type: 'faucet'
      };

      this.showNotification(`Succès ! 10 UKT reçus.`, 'success');
    } catch (err: any) {
      if (err.message && err.message.includes('cooldown')) {
        this.showNotification('Veuillez attendre 2 minutes entre chaque réclamation.', 'error');
      } else {
        this.showNotification(`Erreur Faucet : ${err.message}`, 'error');
      }
    }
  }

  async sendTransfer() {
    if (!this.recipientAddress || !this.transferAmount) {
      this.showNotification('Veuillez spécifier une adresse et un montant valides.', 'error');
      return;
    }

    try {
      this.showNotification('Transaction en cours (Bibliothèque / Photocopies / Transfert)...', 'info');
      const tx = await this.blockchainService.transferTokens(this.recipientAddress, this.transferAmount);
      await this.refreshData();

      this.lastResult = {
        title: 'Paiement / Transfert Réussi !',
        hash: tx.hash,
        amount: `${this.transferAmount} UKT`,
        type: 'send'
      };

      this.recipientAddress = '';
      this.transferAmount = '';
      this.showNotification(`Opération réussie sur la blockchain !`, 'success');
    } catch (err: any) {
      this.showNotification(`Erreur lors de l'opération : ${err.message}`, 'error');
    }
  }
}