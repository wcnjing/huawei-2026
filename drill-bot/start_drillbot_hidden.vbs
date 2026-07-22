' Launches run_drillbot.bat with NO visible window, so the bot runs quietly
' in the background. Put a shortcut to THIS file in your Startup folder to
' have the bot start automatically when you log in to Windows.
Set sh = CreateObject("WScript.Shell")
botDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = botDir
sh.Run """" & botDir & "\run_drillbot.bat""", 0, False
