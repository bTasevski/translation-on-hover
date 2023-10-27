import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "hover-translation" is now active!'
  );
  let disposable = vscode.languages.registerHoverProvider("*", {
    provideHover(document, position) {
      // matches patterns:
      // 1) t("message")
      // 2) t("message"
      // 3) i18nKey="message"
      const tRegex =
        /t\(["']([^"']+)["']\s*[^)]*|i18nKey=["']([^"':]+):([^"']+)["']/;
      const range = document.getWordRangeAtPosition(position, tRegex);
      if (range) {
        const text = document.getText(range);
        const match = tRegex.exec(text);
        if (match) {
          let argument = match[1];
          if (match[0].toString().includes("i18n")) {
            argument = `${match[2]}:${match[3]}`;
          }
          if (argument) {
            const [jsonFileName, translationsKey] = argument.split(":");

            const translationFolders = ["public/translations", "translations"];

            const currentFilePath = document.uri.fsPath;
            const nearestTranslationFolder = findNearestTranslationFolder(
              currentFilePath,
              translationFolders,
              "en-GB"
            );

            if (nearestTranslationFolder) {
              const jsonFilePath = findJsonFile(
                nearestTranslationFolder,
                jsonFileName
              );

              if (jsonFilePath) {
                const jsonContent = fs.readFileSync(jsonFilePath, "utf-8");
                const translations = JSON.parse(jsonContent);
                const translationValue = translations[translationsKey];

                if (translationValue) {
                  const hoverMessage = new vscode.MarkdownString(
                    `🌐${translationValue}🌐`
                  );

                  return new vscode.Hover(hoverMessage, range);
                }
              }
            }
          }
        }
      }
      return undefined;
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

export function deactivate() {}
