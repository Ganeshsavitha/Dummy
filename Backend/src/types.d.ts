declare module "express" {
  const express: any;
  export type Request = any;
  export type Response = any;
  export type NextFunction = any;
  export type Router = any;
  export default express;
}
declare module "cors" {
  const cors: any;
  export default cors;
}
declare module "helmet" {
  const helmet: any;
  export default helmet;
}
declare module "express-rate-limit" {
  const rateLimit: any;
  export default rateLimit;
}
declare module "bcryptjs" {
  const bcrypt: any;
  export default bcrypt;
}
declare module "jsonwebtoken" {
  const jwt: any;
  export default jwt;
}
declare module "@prisma/client" {
  export class PrismaClient {
    [key: string]: any;
  }
}


