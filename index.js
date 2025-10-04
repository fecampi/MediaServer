const fs = require('fs');
const path = require('path');
const { Database } = require('./src/database/Database'); 
const testDatabasePath = path.join(process.cwd(), 'testDatabase.json');


const runTests = async () => {
    const db = new Database(testDatabasePath);


    // Teste 1: Inicializar um banco de dados vazio
    console.log("Test 1 - Initialize an empty database:");
    const users = await db.select('users');
    console.log(users.length === 0 ? 'Passed' : 'Failed');

    // Teste 2: Inserir dados no banco de dados
    console.log("Test 2 - Insert data into the database:");
    const newUser = await db.insert('users', [{ name: 'John Doe' }]);
    const insertedUser = (await db.select('users')).find(user => user.id === newUser.id);
    console.log(insertedUser ? (insertedUser.name === 'John Doe' ? 'Passed' : 'Failed') : 'Failed');

    // Teste 3: Atualizar dados no banco de dados
    console.log("Test 3 - Update data in the database:");
    await db.update('users', newUser.id, { name: 'Jane Doe1' });
    const updatedUser = (await db.select('users')).find(user => user.id === newUser.id);

    // Verifique se o usuário foi encontrado após a atualização
    console.log(updatedUser ? (updatedUser.name === 'Jane Doe1' ? 'Passed' : 'Failed') : 'Failed to find updated user');

    // Teste 4: Deletar dados do banco de dados
    console.log("Test 4 - Delete data from the database:");
    await db.delete('users', newUser.id);
    const remainingUsers = await db.select('users');
    console.log(remainingUsers.length === 0 ? 'Passed' : 'Failed');

    // Limpar o banco de dados após os testes
    await db.cleanUpDatabase();
};

runTests();
