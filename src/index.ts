import { v4 as uuidv4 } from 'uuid';
import { Server, StableBTreeMap, ic } from 'azle';
import express from 'express';
import api from './api';

// Utility functions
function validateEmail(mail: string): boolean {
    const re = /\S+@\S+\.\S+/;
    return re.test(mail);
}

function isValidDate(date: string): boolean {
    return !isNaN(Date.parse(date));
}

function getCurrentDate(): Date {
    const timestamp = new Number(ic.time());
    return new Date(timestamp.valueOf() / 1000_000);
}

function hashPassword(password: string, salt: string): string {
    // Placeholder hashing function, replace with bcrypt or another secure method
    return password + salt;
}

// Models
class User {
    id: string;
    username: string;
    passwordHash: string;
    mail: string;
    createdAt: Date;
    salt: string;

    constructor(id: string, username: string, password: string, mail: string, createdAt: Date) {
        if (!validateEmail(mail)) {
            throw new Error('Invalid email format');
        }
        this.id = id;
        this.username = username;
        this.salt = uuidv4();
        this.passwordHash = hashPassword(password, this.salt);
        this.mail = mail;
        this.createdAt = createdAt;
    }
}

class Crypto {
    id: string;
    symbol: string;
    open: number;
    close: number;
    high: number;
    low: number;
    idx_date: Date;
    createdAt: Date;

    constructor(id: string, symbol: string, open: number, close: number, high: number, low: number, idx_date: Date, createdAt: Date) {
        this.id = id;
        this.symbol = symbol;
        this.open = open;
        this.close = close;
        this.high = high;
        this.low = low;
        this.idx_date = idx_date;
        this.createdAt = createdAt;
    }
}

class ApiKey {
    id: string;
    username: string;
    createdAt: Date;
    expiresAt: Date;

    constructor(id: string, username: string, createdAt: Date, expiresAt: Date) {
        this.id = id;
        this.username = username;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }
}

// Storage Initialization
const CryptoStorage = StableBTreeMap<string, Crypto>(0);
const UserStorage = StableBTreeMap<string, User>(1);
const ApiKeyStorage = StableBTreeMap<string, ApiKey>(2);

const storages = { CryptoStorage, UserStorage, ApiKeyStorage };

// Server Initialization
export default Server(() => {
    const app = express();
    app.use(express.json());
    app.use('/', api(storages));

    // Error handler middleware
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error('Server Error:', err.message);
        res.status(500).json({ error: err.message });
    });

    // POST route for adding OHLC data
    app.post("/ohlc", async (req, res) => {
        try {
            const { symbol, open, close, high, low, idx_date } = req.body;

            // Input validation
            if (!symbol || isNaN(open) || isNaN(close) || isNaN(high) || isNaN(low) || !isValidDate(idx_date)) {
                return res.status(400).json({ error: 'Invalid input' });
            }

            // Insert record
            const crypto: Crypto = {
                id: uuidv4(),
                symbol,
                open,
                close,
                high,
                low,
                idx_date: new Date(idx_date),
                createdAt: getCurrentDate()
            };

            await CryptoStorage.insert(crypto.id, crypto);
            res.status(201).json(crypto);
        } catch (error) {
            next(error);
        }
    });

    // PUT route to update OHLC data by ID
    app.put("/ohlc/:id", async (req, res) => {
        try {
            const { symbol, open, close, high, low, idx_date } = req.body;
            const id = req.params.id;

            // Input validation
            if (!symbol || isNaN(open) || isNaN(close) || isNaN(high) || isNaN(low) || !isValidDate(idx_date)) {
                return res.status(400).json({ error: 'Invalid input' });
            }

            const record = CryptoStorage.get(id);
            if (record.isNone()) {
                return res.status(404).json({ error: 'Record not found' });
            }

            // Update record
            const updatedCrypto: Crypto = {
                ...record.unwrap(),
                symbol,
                open,
                close,
                high,
                low,
                idx_date: new Date(idx_date),
                createdAt: getCurrentDate()
            };

            await CryptoStorage.insert(id, updatedCrypto);
            res.status(200).json(updatedCrypto);
        } catch (error) {
            next(error);
        }
    });

    // DELETE route to remove OHLC data by ID
    app.delete("/ohlc/:id", async (req, res) => {
        try {
            const id = req.params.id;
            const record = CryptoStorage.get(id);

            if (record.isNone()) {
                return res.status(404).json({ error: 'Record not found' });
            }

            await CryptoStorage.remove(id);
            res.status(204).send();  // No content
        } catch (error) {
            next(error);
        }
    });

    // POST route for creating a new user
    app.post("/users", async (req, res) => {
        try {
            const { username, password, mail } = req.body;

            // Input validation
            if (!username || !password || !validateEmail(mail)) {
                return res.status(400).json({ error: 'Invalid input' });
            }

            const user = new User(uuidv4(), username, password, mail, getCurrentDate());
            await UserStorage.insert(user.id, user);

            res.status(201).json(user);
        } catch (error) {
            next(error);
        }
    });

    // POST route to generate an API key for a user
    app.post("/apikeys", async (req, res) => {
        try {
            const { username } = req.body;

            // Input validation
            if (!username) {
                return res.status(400).json({ error: 'Username is required' });
            }

            // Check if user exists
            const userRecords = UserStorage.values();
            const user = userRecords.find(u => u.username === username);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Generate and store API key
            const apiKey = new ApiKey(uuidv4(), username, getCurrentDate(), new Date(Date.now() + 1000 * 60 * 60 * 24 * 30));  // 30 days expiry
            await ApiKeyStorage.insert(apiKey.id, apiKey);

            res.status(201).json(apiKey);
        } catch (error) {
            next(error);
        }
    });

    // GET route to retrieve OHLC data for a symbol
    app.get("/ohlc", (req, res) => {
        const symbol = req.query.symbol as string;

        // Input validation
        if (!symbol) {
            return res.status(400).json({ error: 'Invalid or missing symbol' });
        }

        const records = CryptoStorage.values();
        const values = records.filter((item: Crypto) => item.symbol === symbol);

        res.status(200).json(values);
    });

    // GET route to retrieve OHLC data by ID
    app.get("/ohlc/:id", (req, res) => {
        const id = req.params.id;
        const record = CryptoStorage.get(id);

        if (record.isNone()) {
            return res.status(404).json({ error: 'Record not found' });
        }

        const crypto_details = {
            id: record.unwrap().id,
            symbol: record.unwrap().symbol,
            idx_date: record.unwrap().idx_date,
            createdAt: record.unwrap().createdAt
        };

        res.status(200).json(crypto_details);
    });

    return app.listen();
});
