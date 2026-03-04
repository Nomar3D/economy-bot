import { users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(discordId: string): Promise<User | undefined>;
  getTopUsers(limit?: number): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(discordId: string, updates: Partial<InsertUser>): Promise<User>;
  updateBalance(discordId: string, amount: number): Promise<User>;
  resetAllBalances(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(discordId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.discordId, discordId));
    return user;
  }

  async getTopUsers(limit: number = 10): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.balance)).limit(limit);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(discordId: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users)
      .set(updates)
      .where(eq(users.discordId, discordId))
      .returning();
    return user;
  }

  async updateBalance(discordId: string, amount: number): Promise<User> {
    let user = await this.getUser(discordId);
    if (!user) {
      user = await this.createUser({ discordId, balance: 0 });
    }
    const [updatedUser] = await db.update(users)
      .set({ balance: user.balance + amount })
      .where(eq(users.discordId, discordId))
      .returning();
    return updatedUser;
  }

  async resetAllBalances(): Promise<void> {
    await db.update(users).set({ balance: 0 });
  }
}

export const storage = new DatabaseStorage();
