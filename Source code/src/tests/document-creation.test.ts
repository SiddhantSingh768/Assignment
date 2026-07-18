import assert from 'node:assert';
import { db } from '../../server/db.ts';

async function runTests() {
  console.log('🚀 Starting Automated tests for Collaborative Document Editor...\n');

  try {
    // Test 1: Seeded Users Exist
    console.log('⏳ Running Test 1: Verifying seeded users are loaded...');
    const users = db.getUsers();
    assert.ok(users.length >= 4, 'Should load at least 4 seeded users');
    
    const alice = db.getUserByEmail('alice@example.com');
    assert.ok(alice, 'Alice should be seeded');
    assert.strictEqual(alice.name, 'Alice Smith');
    console.log('✅ Test 1 Passed: Seeded users are verified.');

    // Test 2: Document Creation API / Database Operation
    console.log('⏳ Running Test 2: Verifying Document Creation...');
    const ownerId = 'user-alice-id';
    const docTitle = 'Product Specification PRD';
    const docContent = '<h1>Product Roadmap</h1><p>Step 1: Code, Step 2: Test.</p>';
    
    const doc = db.createDocument(docTitle, docContent, ownerId);
    assert.ok(doc.id, 'Document should have a unique ID');
    assert.strictEqual(doc.title, docTitle, 'Document title should match');
    assert.strictEqual(doc.content, docContent, 'Document content should match');
    assert.strictEqual(doc.ownerId, ownerId, 'Document ownerId should match');
    console.log('✅ Test 2 Passed: Document successfully created and tracked.');

    // Test 3: Document Retrieval and Updates
    console.log('⏳ Running Test 3: Verifying Document Retrieval and Update...');
    const retrieved = db.getDocumentById(doc.id);
    assert.ok(retrieved, 'Should be able to retrieve document by ID');
    
    const updatedTitle = 'Updated Roadmap PRD';
    const updatedContent = '<h1>Product Roadmap V2</h1>';
    const updated = db.updateDocument(doc.id, { title: updatedTitle, content: updatedContent });
    
    assert.ok(updated, 'Update operation should return updated document');
    assert.strictEqual(updated.title, updatedTitle);
    assert.strictEqual(updated.content, updatedContent);
    console.log('✅ Test 3 Passed: Document successfully retrieved and updated.');

    // Test 4: Document Sharing Operations
    console.log('⏳ Running Test 4: Verifying Document Sharing Permissions...');
    const bob = db.getUserByEmail('bob@example.com');
    assert.ok(bob, 'Bob should exist for sharing test');

    // Share document with Bob
    const shareResult = db.shareDocument(doc.id, 'bob@example.com', 'edit');
    assert.strictEqual(shareResult.success, true, 'Sharing should be successful');
    
    // Verify Bob has access
    const bobAccess = db.hasAccess(doc.id, bob.id);
    assert.strictEqual(bobAccess.read, true, 'Bob should have read access');
    assert.strictEqual(bobAccess.edit, true, 'Bob should have edit access');
    
    // Verify Bob's shared document list has this document
    const bobsSharedDocs = db.getSharedDocumentsForUser(bob.id);
    assert.ok(bobsSharedDocs.some(d => d.id === doc.id), 'Document should appear in Bobs shared docs list');
    
    // Alice (Owner) has full access
    const aliceAccess = db.hasAccess(doc.id, ownerId);
    assert.strictEqual(aliceAccess.read, true);
    assert.strictEqual(aliceAccess.edit, true);

    // Random user has no access
    const randomUserAccess = db.hasAccess(doc.id, 'some-random-id');
    assert.strictEqual(randomUserAccess.read, false);
    assert.strictEqual(randomUserAccess.edit, false);
    console.log('✅ Test 4 Passed: Sharing permissions are active and enforced.');

    // Test 5: Document Deletion
    console.log('⏳ Running Test 5: Verifying Document Deletion and Cascade...');
    const deleted = db.deleteDocument(doc.id);
    assert.strictEqual(deleted, true, 'Deletion should succeed');
    
    const searchAfterDelete = db.getDocumentById(doc.id);
    assert.strictEqual(searchAfterDelete, undefined, 'Document should no longer exist');
    
    const bobsSharedDocsAfterDelete = db.getSharedDocumentsForUser(bob.id);
    assert.ok(!bobsSharedDocsAfterDelete.some(d => d.id === doc.id), 'Deleted document should not be shared anymore');
    console.log('✅ Test 5 Passed: Document deletion successfully cascading to shared permissions.');

    console.log('\n⭐ ALL AUTOMATED TESTS PASSED SUCCESSFULLY! ⭐');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
