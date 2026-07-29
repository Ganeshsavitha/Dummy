import { Response } from "express";

export const ResponseHandler = {
  success(res: Response, data: any = {}, message: string = "Success", statusCode: number = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  },
  error(res: Response, error: string = "Error", statusCode: number = 500, details: any = null) {
    return res.status(statusCode).json({
      success: false,
      message: error,
      details
    });
  }
};
