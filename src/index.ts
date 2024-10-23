import { v4 as uuidv4 } from 'uuid';
import { Server, StableBTreeMap, ic } from 'azle';
import express from 'express';
import api from './api';

class User {
  id: string;
  username: string;
  password: string;
  mail: string;
  createdAt: Date;

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

   app.post("/ohlc", (req, res) => {
    console.log('...req.body', {...req.body});
      const crypto: Crypto =  {id: uuidv4(), createdAt: getCurrentDate(), ...req.body};
      CryptoStorage.insert(crypto.id, crypto);
      res.json(crypto);
   });

   app.get("/ohlc", (req, res) => {
    const symbol: any = req.query.symbol;
    console.log('symbol', symbol);

    let records = CryptoStorage.values();
    console.log('records', records)

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
    console.log('startDateParam', startDateParam)
    console.log('endDateParam', endDateParam)

    if (!startDateParam || !endDateParam) {
      res.status(200).json([]);
    }

    const records = CryptoStorage.values();

    let filtered = records.filter((item: Crypto) => {
      const idx_date = new Date(item.idx_date);
      const startDate = new Date(startDateParam);
      const endDate = new Date(endDateParam);
      console.log('startDate', startDate)
      console.log('endDate', endDate)

      return (idx_date > startDate && idx_date < endDate)
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