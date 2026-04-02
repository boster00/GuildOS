/**
 * Adventurer — execution shell around a DB row (`profile`) and a plan runner.
 *
 * `profile` is stored verbatim: assign the object returned from PostgREST / your query,
 * with no renaming or subsetting (e.g. profile.name, profile.capabilities, …).
 */
import { database } from "@/libs/council/database";
import { getSkillBook } from "@/libs/skill_book";
import { ai } from "@/libs/council/ai";

const db = await database.init("server");

class Adventurer {
  constructor(input) {
    if (typeof input === "object" && input !== null) {
      this.profile = input;
    } else if (typeof input === "string") {
      this.profile = db.from("adventurers").select("*").eq("id", input).single();
    }
    if (!this.profile.id) {
      throw new Error("Adventurer init failed, missing id.");
    }
    /** Skill book definitions keyed by catalog name (see `getSkillBook`). */
    this.skillBooks = this.loadSkillBooks();
  }
  loadSkillBooks() {
    const skillBooks = {};
    let names = Array.isArray(this.profile.skill_books) ? this.profile.skill_books : [];
    names.push("default");
    for (const name of names) {
      if (typeof name !== "string" || !name) continue;
      const def = getSkillBook(name);
      if (def) skillBooks[name] = def;
    }
    return skillBooks;
  }
  async executePlan(input) {
    // Accept input of the form { steps: [...] } or just [...]
    if (!this.quest) {
      this.quest = await this.loadQuest(input);
    }
    // execute the plan, the quest has a execution_plan property, each element is like { skillbook, action, input, output }. 
    for (const step of this.quest.execution_plan) {
      const { skillbook, action } = step;
      const inputExample = this.skillBooks[skillbook].toc[action].input;
      const outputExample = this.skillBooks[skillbook].toc[action].output;
      // check if all input fields are found in the quest inventory, if not, incur a skill book default action "organizeInventory" which ask AI to use existing quest details and items to generate items with names matching the expected input fields.
      // a integrate function that return the input in the right format no matter what. 
      const inputObj = await this.getInputSmart(inputExample);
      // const outputObj = await this.skillBooks[skillbook][action](inputObj);
      // perform the action with the inputObj
      const result = await this.skillBooks[skillbook][action](inputObj);
      // append the result to the quest inventory and save the quest to the database.
      await this.appendItemsToQuestInventory(result);
   
      
    }
    // before each step, check the quest inventory, if the steps' input fields are all found in the inventory, then execute the step, otherwise incur a skill book default action "organizeInventory" which ask AI to use existing quest details and items to generate items with names matching the expected input fields.
    return results;
  }
  async appendItemsToQuestInventory(items) {
    if (!Array.isArray(this.quest.inventory)) {
      this.quest.inventory = {};
    }
    this.quest.inventory = { ...this.quest.inventory, ...items };
    await this.saveInventory();
  }
  async saveInventory() {
    await db.from("quests").update({ inventory: this.quest.inventory }).eq("id", this.quest.id);
  }
  async getInputSmart(inputExample) {
    const quest = this.quest;
    let inputObj = {};
    let itemsToOrganize = {};
    // loop through inputExample, map each inventory item with mathcing key to the inputExample key, if the key is not found in inventory, add the key to itemsToOrganize with the value of the inputExample key.
    for (const key in inputExample) {
      const item = quest.inventory.find(item => item.key === key);
      if (item) {
        inputObj[key] = item.value;
      } else {
        itemsToOrganize[key] = inputExample[key];
      }
    }
    // if itemsToOrganize is not empty, call organizeInventory with the itemsToOrganize.
    if (Object.keys(itemsToOrganize).length > 0) {
      const result = await this.organizeInventory(itemsToOrganize);
      inputObj = { ...inputObj, ...result.data.items };
    }
    return inputObj;
  }

  async organizeInventory(itemsToOrganize) {
    const quest = this.quest;
    const prompt = `You are an inventory organizer for a quest execution engine. You are given a quest context, a current inventory, and a list of input keys with example values. You need to deduce and prepare the values of the input keys from the quest context and inventory for the next action.

    Quest context:
    - Title: ${quest.title}
    - Description: ${quest.description}
    
    Current inventory items:
    ${JSON.stringify(quest.inventory, null, 2)}
    
    The next action requires these input keys with example values:
    ${JSON.stringify(itemsToOrganize, null, 2)}
    
    Produce a JSON object with ONLY the keys listed above, deduce their values from the quest context and inventory.
    If a value cannot be determined, use a sensible default or report the problem in a string as the value.
    Respond with ONLY the JSON object. If you cannot determine a value, respond with the string "Cannot determine value for  [keyName].`;
    
    const aiJson = await ai.query({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      resultFormat: itemsToOrganize
    });
    
    return aiJson;
  }
  async loadQuest(input) {
    if (this.quest) {
      return this.quest;
    }
    let quest;
    if (typeof input === "object" && input !== null) {
      quest = input;
    } else if (typeof input === "string") {
      const { data, error } = await db.from("quests").select("*").eq("id", input).single();
      quest = data;
    }
    if (!quest) {
      throw new Error("Quest not found.");
    }
    this.quest = quest;
    return quest;
  }

}

export const adventurer = {
  Adventurer,
};
