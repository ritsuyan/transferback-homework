# Solana 自动转账与 Telegram 通知脚本

该脚本基于 Solana 区块链，能够自动监听代理钱包的交易，检测是否收到转账，并将收到的资金转回到原始地址。每当资金成功转回时，会通过 Telegram 发送通知。

## 环境要求

- Node.js >= 14.x
- Solana Web3.js 库
- Node-telegram-bot-api 库

## 安装依赖

首先，确保你已安装 Node.js。然后，使用以下命令安装所需的库：

```bash
npm install @solana/web3.js node-telegram-bot-api bs58
```

## 配置步骤

### 1. 设置代理钱包的私钥

代理钱包的私钥需要进行解码并转换为 `Keypair` 对象。在 `AgentPrivateKey` 常量中填入你的代理钱包的私钥（Base58 编码）。

```js
const AgentPrivateKey = "你的私钥";
const from = Keypair.fromSecretKey(bs58.default.decode(AgentPrivateKey));
```

### 2. 设置 Telegram Bot

你需要在 Telegram 创建一个机器人并获取 Bot Token。然后，使用该 Token 初始化机器人，并指定接收消息的 chat ID。

```js
const token = '你的Bot Token';
const bot = new TelegramBot(token, { polling: true });
const chatId = '你的聊天ID';
```

### 3. 设置 Solana 网络连接

脚本默认使用 Solana Devnet 网络。如果需要连接到其他网络（例如 Testnet 或 Mainnet），可以修改以下代码：

```js
const connection = new Connection(clusterApiUrl('devnet'), {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
    maxSupportedTransactionVersion: 0
});
```

### 4. 配置转账回原地址的金额和手续费

在 `transferBack` 函数中，`gasFee` 表示手续费，单位是 lamports（1 SOL = 10^9 lamports）。脚本会自动从转账金额中扣除手续费。

```js
const gasFee = 1000; // 交易手续费，单位：lamports
```

## 脚本功能

### 1. 监听最近交易

脚本会定时检查代理钱包的交易记录，通过 `getSignaturesForAddress` 获取最近的交易签名。

```js
async function getRecentTransactions() {
    const signatures = await connection.getSignaturesForAddress(from.publicKey, { limit: 10 });
    return signatures;
}
```

### 2. 转账回原地址

当检测到从代理钱包收到资金时，脚本会调用 `transferBack` 函数将相应金额转回原地址。转账成功后，会通过 Telegram 发送通知。

```js
async function transferBack(toPubkey, amount) {
    const balance = await connection.getBalance(from.publicKey);
    if (balance < (amount + gasFee)) {
        console.error(`余额不足，当前余额：${balance} lamports`);
        return;
    }

    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: from.publicKey,
            toPubkey: new PublicKey(toPubkey),
            lamports: amount - gasFee,
        })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [from]);
    await sendTelegramMessage(`转账成功：${amount / LAMPORTS_PER_SOL} SOL 已发送至 ${toPubkey}`);
}
```

### 3. 发送 Telegram 通知

当转账成功或失败时，脚本会向指定的 Telegram 聊天发送消息。通知的内容包含转账状态、转账金额和目标地址。

```js
async function sendTelegramMessage(message) {
    try {
        await bot.sendMessage(chatId, message);
    } catch (error) {
        console.error('发送 Telegram 消息失败:', error);
    }
}
```

### 4. 持续监听并转账

主函数 `listenAndTransferBack` 会持续监控代理钱包的交易，直到检测到新交易时触发转账操作。

```js
async function listenAndTransferBack() {
    let lastSignature = null;

    while (true) {
        try {
            const signatures = await getRecentTransactions();

            if (signatures.length > 0) {
                const latestSignature = signatures[0].signature;
                if (latestSignature !== lastSignature) {
                    lastSignature = latestSignature;
                    const transaction = await connection.getParsedTransaction(latestSignature);
                    // 处理交易和转账
                }
            }
        } catch (error) {
            console.error('监听转账错误:', error);
        }

        await new Promise(resolve => setTimeout(resolve, 1000)); // 每秒检查一次
    }
}
```

## 启动脚本

完成配置后，运行以下命令启动脚本：

```bash
node index.js
```

## 注意事项

- 请确保代理钱包有足够的资金用于支付手续费。
- 本脚本是为了在 Solana Devnet 上测试和验证功能。若要在主网使用，请修改网络配置。
- 请确保在 Telegram 设置了正确的聊天 ID，以便接收消息。

---

这样文件格式正确并且内容清晰易懂。如果有其他具体功能或者进一步的需求，随时可以告诉我！
