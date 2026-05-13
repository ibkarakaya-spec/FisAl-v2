import { assertSucceeds, assertFails, initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";
import fs from "fs";

let testEnv: RulesTestEnvironment;

describe("Firestore Security Rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "gen-lang-client-0177227353",
      firestore: {
        rules: fs.readFileSync("DRAFT_firestore.rules", "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  test("unauthenticated users cannot read or write any document", async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthDb, "users/any-user")));
    await assertFails(setDoc(doc(unauthDb, "households/any-household"), { name: "Test" }));
  });

  test("authenticated users can read and write their own user document", async () => {
    const authDb = testEnv.authenticatedContext("user1", { email: "user1@example.com", email_verified: true }).firestore();
    const userDoc = doc(authDb, "users/user1");
    await assertSucceeds(setDoc(userDoc, { uid: "user1", email: "user1@example.com" }));
    await assertSucceeds(getDoc(userDoc));
  });

  test("users cannot write someone else's user document", async () => {
    const authDb = testEnv.authenticatedContext("user1", { email: "user1@example.com", email_verified: true }).firestore();
    const otherUserDoc = doc(authDb, "users/user2");
    await assertFails(setDoc(otherUserDoc, { uid: "user2", email: "user2@example.com" }));
  });

  test("members can read household data, non-members cannot", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "households/house1"), { name: "Household 1", adminId: "admin", members: ["admin", "member1"] });
    });

    const memberDb = testEnv.authenticatedContext("member1", { email: "member1@example.com", email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(memberDb, "households/house1")));

    const nonMemberDb = testEnv.authenticatedContext("stranger", { email: "stranger@example.com", email_verified: true }).firestore();
    await assertFails(getDoc(doc(nonMemberDb, "households/house1")));
  });

  test("receipts are only accessible to household members", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "households/house1"), { name: "Household 1", adminId: "admin", members: ["member1"] });
      await setDoc(doc(db, "households/house1/receipts/rec1"), { 
        id: "rec1", vendor: "Store", date: "2023-01-01", total: 100, householdId: "house1", createdBy: "member1" 
      });
    });

    const memberDb = testEnv.authenticatedContext("member1", { email: "member1@example.com", email_verified: true }).firestore();
    await assertSucceeds(getDocs(collection(memberDb, "households/house1/receipts")));

    const strangerDb = testEnv.authenticatedContext("stranger", { email: "stranger@example.com", email_verified: true }).firestore();
    await assertFails(getDocs(collection(strangerDb, "households/house1/receipts")));
  });
});
