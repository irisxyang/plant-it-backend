import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";

export interface TaskDoc extends BaseDoc {
  description: string;
  project: ObjectId;
  // TODO: how to handle ? field
  assignee?: ObjectId;
  completion: boolean;
}

export default class TaskingConcept {
  public readonly tasks: DocCollection<TaskDoc>;

  constructor(collectionName: string) {
    this.tasks = new DocCollection<TaskDoc>(collectionName);
  }

  // TODO: double check assignee logic --> should be undefined if no assignee
  async create(description: string, project: ObjectId, assignee?: ObjectId) {
    const completion = false;
    const _id = await this.tasks.createOne({ description, project, completion, assignee });
    return { msg: "Task successfully created!", task: await this.tasks.readOne({ _id }) };
  }

  async delete(_id: ObjectId) {
    await this.tasks.deleteOne({ _id });
    return { msg: "Task deleted successfully!" };
  }

  async deleteTasksForProject(project: ObjectId) {
    await this.tasks.deleteMany({ project });
    return { msg: "Tasks for project successfully deleted." };
  }

  async updateDescription(_id: ObjectId, description: string) {
    await this.tasks.partialUpdateOne({ _id }, { description });
    return { msg: "Task description successfully updated!" };
  }

  async updateAssignee(_id: ObjectId, assignee: ObjectId) {
    await this.tasks.partialUpdateOne({ _id }, { assignee });
    return { msg: "Task assignee successfully updated!" };
  }

  async getTask(_id: ObjectId) {
    return await this.tasks.readOne({ _id });
  }

  // TODO: how to set a doc field to be undefined?
  async unassignTask(_id: ObjectId) {
    const assignee = undefined;
    await this.tasks.partialUpdateOne({ _id }, { assignee });
    return { msg: "TODO: partial update to null or undefined?" };
  }

  async setCompletionStatus(_id: ObjectId, completion: boolean) {
    await this.tasks.partialUpdateOne({ _id }, { completion });
    if (completion) {
      return { msg: "Task marked as completed!" };
    }
    return { msg: "Task marked incomplete." };
  }

  async getAllTasksForProject(project: ObjectId) {
    return await this.tasks.readMany({ project });
  }

  async getAllTasksForUser(assignee: ObjectId) {
    return await this.tasks.readMany({ assignee });
  }
}
