import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface ProjectDoc extends BaseDoc {
  creator: ObjectId;
  name: string;
}

/**
 * concept: Project
 * stores metadata associated with a Project
 */
export default class ProjectConcept {
  public readonly projects: DocCollection<ProjectDoc>;

  constructor(collectionName: string) {
    this.projects = new DocCollection<ProjectDoc>(collectionName);
  }

  // make new project with some name
  // returns: created project
  async create(creator: ObjectId, name: string) {
    await this.assertProjectNameUnique(name);
    const _id = await this.projects.createOne({ creator, name });
    return { msg: "Project successfully created!", project: await this.projects.readOne({ _id }) };
  }

  // get project by id
  async getProject(_id: ObjectId) {
    return await this.projects.readOne({ _id });
  }

  // get project by name
  async getProjectByName(name: string) {
    return await this.projects.readMany({ name });
  }

  // update project name
  async updateProjectName(_id: ObjectId, name: string) {
    await this.assertProjectNameUnique(name);
    await this.projects.partialUpdateOne({ _id }, { name });

    return { msg: "Project name successfully updated!" };
  }

  // update project
  async updateProjectCreator(_id: ObjectId, creator: ObjectId) {
    await this.projects.partialUpdateOne({ _id }, { creator });

    return { msg: "Project manager successfully updated!" };
  }

  // delete project
  async deleteProject(_id: ObjectId) {
    await this.projects.deleteOne({ _id });
    return { msg: "Project successfully deleted!" };
  }

  // assert user is creator of a project
  // _id: project id, user: user we want to check is creator
  async assertUserIsCreator(_id: ObjectId, user: ObjectId) {
    const project = await this.projects.readOne({ _id });
    if (!project) {
      throw new NotFoundError(`Project ${_id} does not exist!`);
    }
    if (project.creator.toString() !== user.toString()) {
      throw new UserCreatorNotMatchError(user, _id);
    }
  }

  private async assertProjectNameUnique(name: string) {
    if (await this.projects.readOne({ name })) {
      throw new NotAllowedError(`Project with name ${name} already exists! Please choose a different name.`);
    }
  }
}

export class UserCreatorNotMatchError extends NotAllowedError {
  constructor(
    public readonly creator: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the creator of project {1}!", creator, _id);
  }
}
