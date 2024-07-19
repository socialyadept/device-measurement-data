import express, { Request, Response } from "express";
import { open } from "sqlite";
import { Database } from "sqlite3";
import bodyParser from "body-parser";

async function main() {
  const app = express();
  const port = 8090;
  const db = await open({
    filename: ":memory:",
    driver: Database,
  });

  app.use(bodyParser.json());

  // Initialize DB here
  {
    await db.run(
      "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)"
    );
    await db.run(
      "CREATE TABLE devices (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, FOREIGN KEY(user_id) REFERENCES users(id))"
    );
    await db.run(
      "CREATE TABLE measurements (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id INTEGER, temperature REAL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(device_id) REFERENCES devices(id))"
    );
  }

  // Register a new device
  app.post("/devices", async (req: Request, res: Response) => {
    const { userId, deviceName } = req.body;
    try {
      const payload = await db.run(
        "INSERT INTO devices (user_id, name) VALUES (?, ?)",
        [userId, deviceName]
      );
      res.status(201).json({
        message: "Device registered successfully",
        data: { deviceID: payload.lastID, deviceName },
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Observe historical temperature measurements
  app.get(
    "/devices/:deviceId/measurements",
    async (req: Request, res: Response) => {
      const { deviceId } = req.params;
      try {
        const measurements = await db.all(
          "SELECT temperature, timestamp FROM measurements WHERE device_id = ?",
          [deviceId]
        );
        res.json(measurements);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  );

  // Device sends temperature measurement
  app.post(
    "/devices/:deviceId/measurements",
    async (req: Request, res: Response) => {
      const { deviceId } = req.params;
      const { temperature, timestamp } = req.body;
      try {
        await db.run(
          "INSERT INTO measurements (device_id, temperature, timestamp) VALUES (?, ?, ?)",
          [deviceId, temperature, timestamp]
        );
        res.status(201).json({
          message: "Measurement recorded successfully",
          data: { temperature, deviceId, timestamp },
        });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  );

  // Device sends temperature measurements (batch)
  app.post(
    "/devices/:deviceId/measurements",
    async (req: Request, res: Response) => {
      const { deviceId } = req.params;
      const measurements = req.body; // Assuming the body is an array of { temperature, timestamp } objects
      try {
        const insertPromises = measurements.map(
          (measurement: { temperature: number; timestamp?: string }) => {
            return db.run(
              "INSERT INTO measurements (device_id, temperature, timestamp) VALUES (?, ?, ?)",
              [
                deviceId,
                measurement.temperature,
                measurement.timestamp || new Date(),
              ]
            );
          }
        );
        await Promise.all(insertPromises);
        res.status(201).json({ message: "Measurements recorded successfully" });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  );

  // Run the app
  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
}

main();
