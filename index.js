const { Connection,clusterApiUrl, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction, Keypair } = require('@solana/web3.js');
const AgentPrivateKey = "nrPDeXiv6TADusNoqLSTJ2ss2S44kwuM7NaMXZuGdteTiBv9bqDw1FX4Zd3XKW9jCdfjMPQcpRZVTsETGYcp4ah";
const bs58 = require('bs58');
const from = Keypair.fromSecretKey(bs58.default.decode(AgentPrivateKey));
const TelegramBot = require('node-telegram-bot-api');

// Initialize Telegram bot
const token = '8051441192:AAFefKpEPDX_Yz167uL-agk1GUJOrU87LBc';
const bot = new TelegramBot(token, { polling: true });
const chatId = '7070158068'; 

const connection = new Connection(clusterApiUrl('devnet'), {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
    maxSupportedTransactionVersion: 0
});

// Function to send messages to Telegram
async function sendTelegramMessage(message) {
    try {
        await bot.sendMessage(chatId, message);
    } catch (error) {
        console.error('Error sending message to Telegram:', error);
    }
}

// Function to get recent transactions for the Agent Wallet
async function getRecentTransactions() {
  const signatures = await connection.getSignaturesForAddress(from.publicKey, {
    limit: 10, // Adjust the limit as needed
    maxSupportedTransactionVersion: 0
  });
  return signatures;
}

// Function to transfer funds back to the original address
async function transferBack(toPubkey, amount) {
    const gasFee = 1000;

    try {
        const balance = await connection.getBalance(from.publicKey);
        if (balance < (amount + gasFee)) {
            console.error(`Insufficient funds to transfer ${amount} lamports. Current balance: ${balance} lamports.`);
            return; // Exit if insufficient funds
        }

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: from.publicKey,
                toPubkey: new PublicKey(toPubkey),
                lamports: amount - gasFee, // Deduct gas fee from the transfer amount
            })
        );

        const signature = await sendAndConfirmTransaction(connection, transaction, [from]);
        console.log('Transfer successful with signature:', signature);
        await sendTelegramMessage(`Transfer successful: ${amount / LAMPORTS_PER_SOL} SOL sent to ${toPubkey}`);
    } catch (error) {
        console.error('Error transferring funds back:', error);
        await sendTelegramMessage(`Transfer failed: ${error.message}`);
    }
}

// Main function to listen for incoming transactions and transfer funds back
async function listenAndTransferBack() {
    let lastSignature = null;

    while (true) {
        try {
            const signatures = await getRecentTransactions();

            if (signatures.length > 0) {
                const latestSignature = signatures[0].signature;

                if (latestSignature !== lastSignature) {
                    lastSignature = latestSignature;

                    const transaction = await connection.getParsedTransaction(latestSignature, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0
                    });

                    if (transaction && transaction.transaction) {
                        const { message } = transaction.transaction;

                        if (message && message.instructions) {
                            for (const instruction of message.instructions) {
                                if (instruction.parsed && instruction.parsed.type === 'transfer') {
                                    const destination = new PublicKey(instruction.parsed.info.destination);
                                    if (destination.equals(from.publicKey)) {
                                        const fromPubkey = instruction.parsed.info.source;
                                        const amountInLamports = instruction.parsed.info.lamports;

                                        await transferBack(fromPubkey, amountInLamports);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in listenAndTransferBack:', error);
        }

        await new Promise(resolve => setTimeout(resolve, 1000)); // Polling interval
    }
}

// Start the listener
listenAndTransferBack().catch(console.error);

