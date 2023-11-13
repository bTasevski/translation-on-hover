import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

type TranslationKeyWithFileName = {
  translationsFileName: string | undefined;
  translationKey: string | undefined;
};

const TRANSLATIONS_FOLDERS_PATHS = ["public/translations", "translations"];

const LOCALE = "en-GB";

// matches patterns:
// 1) t("message")
// 2) t("message"
// 3) i18nKey="message"
const T_REGEX =
  /t\(["']([^"']+)["']\s*[^)]*|i18nKey=["']([^"':]+):([^"']+)["']/;

//matches: useTranslations("main")
const TRANSLATIONS_FILE_NAME_REGEX = /useTranslations\(['"]([^'"]+)['"]\);/;

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.languages.registerHoverProvider("*", {
    provideHover(document, position) {
      const matchedTranslationUsage = matchTranslation(document, position);
      if (!matchedTranslationUsage) {
        return undefined;
      }
      const { translationKey, translationsFileName } =
        getTranslationsFileNameAndTranslationKey(matchedTranslationUsage);
      if (translationKey === undefined || translationsFileName === undefined) {
        return undefined;
      }

      const currentFilePath = document.uri.fsPath;
      const nearestTranslationFolder = findNearestTranslationFolder(
        currentFilePath,
        TRANSLATIONS_FOLDERS_PATHS,
        LOCALE
      );

      if (!Boolean(nearestTranslationFolder)) {
        return undefined;
      }

      const translationsFilePath = findTranslationsFile(
        nearestTranslationFolder!,
        translationsFileName
      );

      if (!Boolean(translationsFilePath)) {
        return undefined;
      }

      const jsonContent = fs.readFileSync(translationsFilePath!, "utf-8");
      const translations = JSON.parse(jsonContent);
      const translatedValue = translations[translationKey] as string;

      return createHoverMessage(translatedValue, document, position);
    },
  });

  context.subscriptions.push(disposable);
}

function findTranslationsFile(
  directory: string,
  fileName: string
): string | null {
  const translationsFilePath = path.join(directory, `${fileName}.json`);
  if (fs.existsSync(translationsFilePath)) {
    return translationsFilePath;
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

function getTranslationsFileNameAndTranslationKey(
  matchedTranslationUsage: RegExpExecArray
): TranslationKeyWithFileName {
  let argument = matchedTranslationUsage[1];
  if (matchedTranslationUsage[0].toString().includes("i18n")) {
    argument = `${matchedTranslationUsage[2]}:${matchedTranslationUsage[3]}`;
  }

  if (Boolean(matchedTranslationUsage.toString().includes(":"))) {
    const [translationsFileName, translationKey] = argument.split(":");
    return {
      translationKey,
      translationsFileName,
    } as TranslationKeyWithFileName;
  }

  const currentFile = vscode.window.activeTextEditor?.document.getText();
  const useTranslationsHookWithFileNameMatch = currentFile?.match(
    TRANSLATIONS_FILE_NAME_REGEX
  );
  if (!useTranslationsHookWithFileNameMatch) {
    return { translationKey: undefined, translationsFileName: undefined };
  }
  const translationKey = matchedTranslationUsage[1];
  const translationsFileName = useTranslationsHookWithFileNameMatch[1];

  return {
    translationKey,
    translationsFileName,
  } as TranslationKeyWithFileName;
}

function matchTranslation(
  document: vscode.TextDocument,
  position: vscode.Position
): RegExpExecArray | undefined {
  const range = document.getWordRangeAtPosition(position, T_REGEX);
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
  const range = document.getWordRangeAtPosition(position, T_REGEX);

  const hoverMessage = new vscode.MarkdownString(`🌐 ${translatedText}`);

  return new vscode.Hover(hoverMessage, range);
}

export function deactivate() {}
