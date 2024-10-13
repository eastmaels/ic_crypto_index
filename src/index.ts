import { v4 as uuidv4 } from 'uuid';
import { Server, StableBTreeMap, ic } from 'azle';
import express from 'express';
import api from './api';

class User {
    constructor(id: string, username: string, password: string, mail: string, createdAt: Date) {
        if (!validateEmail(mail)) {
            throw new Error('Invalid email format');
        }

        this.id = id;
        this.username = username;
        this.passwordHash = hashPassword(password, this.salt);
        this.mail = mail;
        this.createdAt = createdAt;
    }
}

function validateEmail(mail: string): boolean {
    const re = /\S+@\S+\.\S+/;
    return re.test(mail);
}


  constructor(id: string, username: string, password: string, mail: string, createdAt: Date) {
      this.id = id;
      this.username = username;
      this.password = password;
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

  constructor(
    id: string,
    symbol: string,
    open: number,
    close: number,
    high: number,
    low: number,
    idx_date: Date,
    createdAt: Date) {
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

const CryptoStorage = StableBTreeMap<string, Crypto>(0);
const UserStorage = StableBTreeMap<string, User>(1);
const ApiKeyStorage = StableBTreeMap<string, ApiKey>(2);

const storages = { CryptoStorage, UserStorage, ApiKeyStorage };

export default Server(() => {
   const app = express();
   app.use(express.json());

   app.use('/', api(storages));

   app.post("/ohlc", async (req, res) => {
    try {
        const { symbol, open, close, high, low, idx_date } = req.body;

        // Input validation
        if (!symbol || isNaN(open) || isNaN(close) || isNaN(high) || isNaN(low) || !isValidDate(idx_date)) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        // Insert record
        const crypto: Crypto = { id: uuidv4(), createdAt: getCurrentDate(), ...req.body };
        await CryptoStorage.insert(crypto.id, crypto);

        res.status(201).json(crypto);  // Successful response
    } catch (error) {
        console.error('Error inserting OHLC data:', error);
        res.status(500).json({ error: 'Failed to insert OHLC data' });
    }
});

function isValidDate(date: string): boolean {
    return !isNaN(Date.parse(date));
}

app.get("/ohlc", (req, res) => {
    const symbol = req.query.symbol;

    // Input validation
    if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing symbol' });
    }

    let records = CryptoStorage.values();
    let values = records.filter((item: Crypto) => item.symbol === symbol);

    res.status(200).json(values);
});


    let values: any = [];
    if (symbol) {
      values = records.map((item: Crypto) => {
        console.log('item', item)
        if (item.symbol === symbol) {
          return {
            id: item.id,
            symbol: item.symbol,
            open: item.open,
            close: item.close,
            high: item.high,
            low: item.low,
            idx_date: item.idx_date,
            createdAt: item.createdAt
          }
        }
      });
    }

    res.status(200).json(values);
   });

    app.get("/ohlc/by_date", (req, res) => {
    const startDateParam = req.query.startDate;
    const endDateParam = req.query.endDate;

    // Validate date inputs
    if (!startDateParam || !endDateParam || isNaN(Date.parse(startDateParam)) || isNaN(Date.parse(endDateParam))) {
        return res.status(400).json({ error: 'Invalid date parameters' });
    }

    const records = CryptoStorage.values();
    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    let filtered = records.filter((item: Crypto) => {
        const idx_date = new Date(item.idx_date);
        return (idx_date >= startDate && idx_date <= endDate);  // Include boundaries
    });

    res.status(200).json(filtered);
});


    const items = filtered.map(item => {
      return {
        id: item.id,
        symbol: item.symbol,
        open: item.open,
        close: item.close,
        high: item.high,
        low: item.low,
        idx_date: item.idx_date,
        createdAt: item.createdAt
      };
    })

    res.status(200).json(items);
   });

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
    };

    res.status(200).json(crypto_details);
});

  //  app.get("/ohlc/:id", (req, res) => {
  //   const id = req.params.id;
  //   const record = CryptoStorage.get(id).Some;
  //   const crypto_details = {
  //     id: record?.id,
  //     symbol: record?.symbol,
  //     idx_date: record?.idx_date,
  //   }
  //   console.log('crypto_details', crypto_details);
  //   res.status(200).json(crypto_details);
  //  });

   return app.listen();
});

function getCurrentDate() {
   const timestamp = new Number(ic.time());
   return new Date(timestamp.valueOf() / 1000_000);
}
