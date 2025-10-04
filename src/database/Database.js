const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

class Database {
  #db;
  #adapter;
  #databasePath;

  /**
   * Creates a new instance of Database and loads the data from the JSON file.
   * If the file does not exist, the database will be empty.
   * @param {string} databasePath - The relative path of the JSON database file.
   */
  constructor(databasePath) {
    this.#databasePath = databasePath;
    this.#adapter = new FileSync(databasePath);
    this.#db = low(this.#adapter);
  }

  /**
   * Returns the data from the specified table.
   * @param {string} table - Name of the table.
   * @param {Object} [search] - Optional search criteria.
   * @returns {Promise<Array>} - Data from the specified table.
   */
  async select(table, search) {
    let data = (await this.#db.get(table).value()) || [];

    if (search) {
      data = data.filter((row) => {
        return Object.entries(search).some(([key, value]) => {
          return (
            row[key] && row[key].toLowerCase().includes(value.toLowerCase())
          );
        });
      });
    }
    return data;
  }

  /**
   * Inserts data into the specified table.
   * If the table doesn't exist, it creates the table first.
   * If the data is an array of objects, all objects will be inserted.
   * @param {string} table - Name of the table.
   * @param {Object|Array<Object>} data - Data or array of objects to be inserted into the table.
   * @returns {Promise<Object|Array<Object>>} - Data or array of objects inserted into the table.
   */
  async insert(table, data) {
    const tableExists = await this.#db.has(table).value();
    if (!tableExists) {
      await this.#db.set(table, []).write();
    }

    if (Array.isArray(data)) {
      const newDataArray = data.map((item) => ({ id: randomUUID(), ...item }));
      await this.#db
        .get(table)
        .push(...newDataArray)
        .write();
      return newDataArray;
    } else {
      const newData = { id: randomUUID(), ...data };
      await this.#db.get(table).push(newData).write();
      return newData;
    }
  }

  /**
   * Updates data in the specified table by ID.
   * @param {string} table - Name of the table.
   * @param {string} id - ID of the data to be updated.
   * @param {Object} data - New data to update.
   * @returns {Promise<void>}
   */
  async update(table, id, data) {
    const existingData = await this.#db.get(table).find({ id }).value();

    if (existingData) {
      await this.#db.get(table).find({ id }).assign(data).write();
    }
  }

  /**
   * Deletes data from the specified table by ID.
   * @param {string} table - Name of the table.
   * @param {string} id - ID of the data to be deleted.
   * @returns {Promise<void>}
   */
  async delete(table, id) {
    const before = await this.#db.get(table).value().length;
    await this.#db.get(table).remove({ id }).write();
    const after = await this.#db.get(table).value().length;
    return after < before;
  }

  /**
   * Finds a record by ID in the specified table.
   * @param {string} table - Name of the table.
   * @param {string} id - ID to search for.
   * @returns {Promise<Object|null>} - The found record or null.
   */
  async findById(table, id) {
    const row = await this.#db.get(table).find({ id }).value();
    return row || null;
  }

  /**
   * Cleans up the database by deleting the file.
   * @returns {Promise<void>}
   */
  async cleanUpDatabase() {
    if (fs.existsSync(this.#databasePath)) {
      fs.unlinkSync(this.#databasePath);
    }
  }
}

module.exports = { Database };
