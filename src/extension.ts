import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

type TranslationKeyWithFileName = {
  jsonFileName: string;
  translationsKey: string;
};

const TRANSLATIONS_FOLDERS_PATHS = ["public/translations", "translations"];

const LOCALE = "en-GB";

// matches patterns:
// 1) t("message")
// 2) t("message"
// 3) i18nKey="message"
const T_REGEX =
  /t\(["']([^"']+)["']\s*[^)]*|i18nKey=["']([^"':]+):([^"']+)["']/;

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "hover-translation" is now active!'
  );
  let disposable = vscode.languages.registerHoverProvider("*", {
    provideHover(document, position) {
      const matchedText = matchTranslation(document, position);
      if (!matchedText) {
        return undefined;
      }

      const { translationsKey, jsonFileName } =
        getJsonFileNameAndTranslationKey(matchedText);

      const currentFilePath = document.uri.fsPath;
      const nearestTranslationFolder = findNearestTranslationFolder(
        currentFilePath,
        TRANSLATIONS_FOLDERS_PATHS,
        LOCALE
      );

      if (!Boolean(nearestTranslationFolder)) {
        return undefined;
      }

      const translationsFilePath = findJsonFile(
        nearestTranslationFolder!,
        jsonFileName
      );

      if (!Boolean(translationsFilePath)) {
        return undefined;
      }
      console.log("qw23er123123");
      const jsonContent = fs.readFileSync(translationsFilePath!, "utf-8");
      const translations = JSON.parse(jsonContent);
      const translatedValue = translations[translationsKey] as string;

      return createHoverMessage(translatedValue, document, position);
    },
  });

  context.subscriptions.push(disposable);
}

function findJsonFile(directory: string, fileName: string): string | null {
  const jsonFilePath = path.join(directory, `${fileName}.json`);
  if (fs.existsSync(jsonFilePath)) {
    return jsonFilePath;
  }
  return null;
}

function findNearestTranslationFolder(
  filePath: string,
  translationFolderNames: string[],
  languageCode: string
): string | null {
  const searchForTranslationFolder = (
    dir: string,
    workspaceFolders: readonly vscode.WorkspaceFolder[]
  ): string | null => {
    for (const folderName of translationFolderNames) {
      const translationFolderPath = path.join(dir, folderName, languageCode);
      if (
        fs.existsSync(translationFolderPath) &&
        fs.statSync(translationFolderPath).isDirectory()
      ) {
        return translationFolderPath;
      }
    }

    const parentDir = path.dirname(dir);

    if (parentDir === dir || !isWithinWorkspace(dir, workspaceFolders)) {
      return null;
    }

    return searchForTranslationFolder(parentDir, workspaceFolders);
  };

  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  const filePathDir = path.dirname(filePath);
  return searchForTranslationFolder(filePathDir, workspaceFolders);
}

const isWithinWorkspace = (
  dir: string,
  workspaceFolders: readonly vscode.WorkspaceFolder[]
): boolean => {
  return workspaceFolders.some((workspaceFolder) =>
    dir.startsWith(workspaceFolder.uri.fsPath)
  );
};

function getJsonFileNameAndTranslationKey(
  matchedText: RegExpExecArray
): TranslationKeyWithFileName {
  let argument = matchedText[1];
  if (matchedText[0].toString().includes("i18n")) {
    argument = `${matchedText[2]}:${matchedText[3]}`;
  }
  const [jsonFileName, translationsKey] = argument.split(":");
  return { translationsKey, jsonFileName } as TranslationKeyWithFileName;
}

function matchTranslation(
  document: vscode.TextDocument,
  position: vscode.Position
): RegExpExecArray | undefined {
  const range = getRange(document, position);
  if (range) {
    const text = document.getText(range);
    const match = T_REGEX.exec(text);
    if (match) {
      return match;
    }
    return undefined;
  }
}

function createHoverMessage(
  translatedText: string,
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Hover {
  const range = getRange(document, position);

  const hoverMessage = new vscode.MarkdownString(`🌐 ${translatedText}`);

  return new vscode.Hover(hoverMessage, range);
}

function getRange(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Range | undefined {
  return document.getWordRangeAtPosition(position, T_REGEX);
}

export function deactivate() {}
