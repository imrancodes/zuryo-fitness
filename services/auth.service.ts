import "server-only";
import bcrypt from "bcryptjs";
import { isValidObjectId, type Types } from "mongoose";
import { isDuplicateKeyError, ServiceError } from "@/lib/errors";
import { connectToDatabase } from "@/lib/mongodb";
import type { Role } from "@/lib/roles";
import { User } from "@/models/User";
import type { PublicUser } from "@/types/user";
import type { RegisterInput } from "@/validators/auth";

const HASH_ROUNDS = 10;
const TIMING_GUARD_HASH = bcrypt.hashSync("zuryo-timing-guard", HASH_ROUNDS);

type UserLike = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
};

export function toPublicUser(user: UserLike): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
  };
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, HASH_ROUNDS);
}

export async function registerUser(input: RegisterInput) {
  await connectToDatabase();
  await User.init();

  try {
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
    });
    return toPublicUser(user);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ServiceError(409, "An account with this email already exists");
    }
    throw error;
  }
}

export async function authenticate(email: string, password: string) {
  await connectToDatabase();
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? TIMING_GUARD_HASH);

  if (!user || !passwordMatches || !user.isActive) {
    return null;
  }

  return toPublicUser(user);
}

export async function getActiveUserById(id: string) {
  if (!isValidObjectId(id)) {
    return null;
  }

  await connectToDatabase();
  const user = await User.findOne({ _id: id, isActive: true });
  return user ? toPublicUser(user) : null;
}

export async function getActiveUserByEmail(email: string) {
  await connectToDatabase();
  const user = await User.findOne({ email, isActive: true });
  return user ? toPublicUser(user) : null;
}

export async function namesById(ids: (Types.ObjectId | string | null | undefined)[]) {
  await connectToDatabase();
  const users = await User.find({ _id: { $in: ids.filter(Boolean) } }, "name").lean();
  const names = new Map(users.map((user) => [user._id.toString(), user.name]));
  return (id: Types.ObjectId | string) => ({ id: id.toString(), name: names.get(id.toString()) ?? "Unknown" });
}

export async function listUsers() {
  await connectToDatabase();
  const users = await User.find().sort({ createdAt: -1 }).limit(100);
  return users.map(toPublicUser);
}
