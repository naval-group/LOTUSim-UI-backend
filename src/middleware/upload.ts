import multer from "multer";
import path from "path";
import fs from "fs";
import { modelsPath } from "../utils";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(modelsPath)) {
      fs.mkdirSync(modelsPath, { recursive: true });
    }
    cb(null, modelsPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

export default upload;
