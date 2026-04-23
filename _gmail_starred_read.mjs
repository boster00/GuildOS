import "dotenv/config";
const userId = process.env.PIGEON_POST_OWNER_ID;
const gmail = await import("./libs/weapon/gmail/index.js");
// All starred inbox, recent
const starred = await gmail.searchMessages({ query: "is:starred in:inbox", limit: 5 }, userId);
console.log("starred count:", starred.length);
for (const msg of starred) {
  console.log(msg.subject, "|", msg.from);
}
