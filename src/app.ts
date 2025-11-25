/*
 * Copyright (c) 2025 Naval Group
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 */
import express, { Express, Request, Response } from "express";
import cors from "cors";
import path from "path";
import { modelsPath } from "./utils";
import modelsRoutes from "./routes/models-routes";
import instancesRoutes from "./routes/instances-routes";
import scenariosRoutes from "./routes/scenarios-routes";
import uploadRoutes from "./routes/upload-routes";

export class App {
    #app: Express;

    constructor() {
        this.#app = express();
        this.configureMiddleware();
        this.configureRoutes();
    }

    private configureMiddleware(): void {

        this.#app.use(cors());
        this.#app.use(express.json());
        this.#app.use('/models', express.static(path.join(modelsPath)));
    }

    private configureRoutes(): void {
        this.#app.use("/", modelsRoutes);
        this.#app.use("/", instancesRoutes);
        this.#app.use("/", scenariosRoutes);
        this.#app.use("/", uploadRoutes);
    }

    public listen(port: number): void {
        this.#app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    }

    public getExpressApp(): Express {
        return this.#app;
    }
}
