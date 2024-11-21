import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError } from "./errors";

export interface GroupItemDoc extends BaseDoc {
  group: ObjectId;
  item: ObjectId;
}

/**
 * concept: Grouping
 */
export default class GroupItemConcept {
  public readonly groupitems: DocCollection<GroupItemDoc>;

  constructor(collectionName: string) {
    this.groupitems = new DocCollection<GroupItemDoc>(collectionName);
  }

  // add an item to a group
  async addGroupItem(group: ObjectId, item: ObjectId) {
    await this.groupitems.createOne({ group, item });
    return { msg: "Added item to group!" };
  }

  // remove an item from a group
  async removeGroupItem(group: ObjectId, item: ObjectId) {
    await this.groupitems.deleteOne({ group, item });
    return { msg: "Removed item from group!" };
  }

  // get all items in a group
  async getItemsInGroup(group: ObjectId) {
    const items = await this.groupitems.readMany({ group }, { projection: { item: 1 } });

    return items;
  }

  // get groups that an item is in
  async getGroupsForItem(item: ObjectId) {
    return await this.groupitems.readMany({ item });
  }

  // delete all items in a group
  // (use when deleting a group)
  async deleteAllItemsInGroup(group: ObjectId) {
    await this.groupitems.deleteMany({ group });
    return { msg: "Deleted all instances of group!" };
  }

  // delete item from all groups that it is in
  // use when deleting an item
  async deleteItemFromAllGroups(item: ObjectId) {
    await this.groupitems.deleteMany({ item });
    return { msg: "Deleted all instances of item!" };
  }

  // assert that an item is in a given group
  async assertItemInGroup(group: ObjectId, item: ObjectId) {
    const pair = await this.groupitems.readOne({ group, item });
    if (!pair) {
      throw new NotFoundError(`Item ${item} not in group ${group}!`);
    }
  }
}
