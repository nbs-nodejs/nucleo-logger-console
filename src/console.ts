import winston, { format } from "winston";
import { Logger } from "@nbsdev/nucleo-logger";

const SCOPE_MAX_LEN = 18;

export interface LoggerOption {
    error?: Error;
    metadata?: LoggerMetadata;
}

export interface LoggerMetadata {
    [k: string]: unknown;
}

export class ConsoleLogger implements Logger {
    private readonly name: string;
    private readonly debugMode: boolean;
    private logger: winston.Logger;

    constructor(options: {
        name: string;
        logLevel?: string;
        format?: string;
        debugMode?: boolean;
        _child?: winston.Logger;
    }) {
        // Set members
        this.debugMode = options.debugMode === true;
        this.name = options.name;

        // Determine log formatter
        let logFmt;
        if (options.format === "console") {
            logFmt = this.handleConsoleFormat;
        } else {
            logFmt = format.combine(format.timestamp(), format.json());
        }

        // Sanitize log level
        switch (options.logLevel) {
            case "debug":
            case "error":
            case "info":
            case "warn":
                break;
            default:
                options.logLevel = "info";
        }

        // If child, then set child
        if (options._child) {
            this.logger = options._child;
        } else {
            this.logger = winston.createLogger({
                level: options.logLevel,
                format: logFmt,
                transports: [new winston.transports.Console()],
            });
        }
    }

    debug(message: string, options?: LoggerOption): void {
        this.logger.debug(message, this.getMetadata(options));
    }

    error(message: string, options?: LoggerOption): void {
        this.logger.error(message, this.traceError(options));
    }

    info(message: string, options?: LoggerOption): void {
        this.logger.info(message, this.getMetadata(options));
    }

    warn(message: string, options?: LoggerOption): void {
        this.logger.warn(message, this.getMetadata(options));
    }

    createChild(scope: string): Logger {
        return new ConsoleLogger({
            name: this.name,
            _child: this.logger.child({ scope: scope }),
        });
    }

    getMetadata(options?: LoggerOption): LoggerMetadata | null {
        if (!options || !options.metadata) {
            return null;
        }

        return {
            metadata: options.metadata,
        };
    }

    traceError(options?: LoggerOption): LoggerMetadata | null {
        if (!this.debugMode) {
            return null;
        }

        if (!options) {
            options = {};
        }

        if (!options.metadata) {
            options.metadata = {};
        }

        if (!options.error) {
            options.error = new Error();
        }

        return {
            stackTrace: options.error.stack,
            metadata: options.metadata,
        };
    }

    handleConsoleFormat = format.combine(
        format.timestamp({}),
        format.colorize({
            all: true,
        }),
        format.printf((info): string => {
            // Format metadata
            let metadata = this.stringifyMetadata(info);
            if (metadata) {
                metadata = `\n  > [metadata]${metadata}`;
            }

            // Format stack trace
            let stackTrace = "";
            if (info.stackTrace) {
                stackTrace = "\n  > [stackTrace] " + info.stackTrace;
            }

            // info.level include color characters so it length up to 15
            const level = info.level.toString().padStart(15, " ");

            // Trim scope max to 20 char
            let scope = info.scope || this.name;
            if (scope.length > SCOPE_MAX_LEN) {
                scope = scope.substr(0, SCOPE_MAX_LEN);
            } else {
                scope = scope.padStart(SCOPE_MAX_LEN, " ");
            }

            return `[${info.timestamp}] ${level}: ${scope} | ${info.message}${metadata}${stackTrace}`;
        })
    );

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    stringifyMetadata(info: any): string {
        const m = info.metadata;

        if (m == null) {
            return "";
        }

        switch (typeof m) {
            case "string": {
                return " " + m;
            }
            case "object": {
                // If is array and has item, then print
                if (Array.isArray(m)) {
                    if (m.length <= 0) {
                        return "";
                    }
                    return " " + JSON.stringify(m);
                }

                // If object has keys, then print
                if (Object.keys(m).length > 0) {
                    return " " + JSON.stringify(m);
                }

                return "";
            }
            default: {
                return "";
            }
        }
    }
}
