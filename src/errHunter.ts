import fs from "fs";
import path from "path";
import chalk from "chalk";
import _ from "lodash";
import ErrorStackParser, { StackFrame } from "error-stack-parser";
import { SourceMapConsumer, NullableMappedPosition } from "source-map";

interface FnRange {
  start: number;
  end: number;
}

interface Location {
  fileName: string;
  line: number;
  column: number;
}

interface Code {
  fileName: string;
  content: string;
  startLineNumber: number;
  endLineNumber: number;
}

export class ErrHunter {
  private readonly _err: Error;

  constructor(err: Error) {
    this._err = err;
  }

  async getErrorTrace(): Promise<string> {
    const userStackFrames = this._getUserStackFrames();
    let result = `${this._err.name}: ${this._err.message}\n`;
    for(const frame of userStackFrames) {
      const errLocation = this._getLocation(frame);
      const originalPosition = await this._getOriginalPosition(errLocation);
      if (originalPosition === null ||
          originalPosition.source === null ||
          originalPosition.line === null ||
          originalPosition.column === null) {
        continue;
      }
      const errFilePath = path.normalize(`${path.dirname(errLocation.fileName)}/${originalPosition.source}`);
      let location = `${chalk.cyan(errFilePath)}:${chalk.yellow(originalPosition.line)}:${chalk.yellow(originalPosition.column)}`;
      if(frame.functionName) {
        location = `${frame.functionName} (${location})`;
      }
      location = `    at ${location}\n`;
      result += location;
    }
    return result;
  }

  private _getUserStackFrames(): StackFrame[] {
    const errStackFrames = ErrorStackParser.parse(this._err);
    return _
      .chain(errStackFrames)
      .filter(e => e.getFileName().indexOf("node_modules") === -1) // ignore all files in node_modules
      .filter(e => e.getFileName().startsWith("/")) // ignore non project file
      .value();
  }

  private _getLocation(stackFrame: StackFrame): Location {
    return {
      fileName: stackFrame.getFileName(),
      line: stackFrame.getLineNumber(),
      column: stackFrame.getColumnNumber(),
    }
  }

  private _getOriginalPosition(location: Location): Promise<NullableMappedPosition | null> {
    return new Promise((resolve, reject) => {
      const sourceMapPath = `${location.fileName}.map`;
      if (!fs.existsSync(sourceMapPath)) {
        console.warn(`[ts-err-hunter] Can't find source map in path: ${sourceMapPath}!`);
        return resolve(null);
      }
      const sourceMap = JSON.parse(fs.readFileSync(sourceMapPath).toString());
      SourceMapConsumer.with(sourceMap, null, consumer => {
        const res = consumer.originalPositionFor({
          line: location.line,
          column: location.column,
        });
        return resolve(res);
      });
    });
  }
}
