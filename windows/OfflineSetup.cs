using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;

internal static class OfflineSetup
{
    private const string Payload = "MobilePartsCRM.Payload.zip";

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length == 1 && args[0] == "--check-package")
        {
            using (ZipArchive archive = OpenPayload())
            {
                foreach (string name in new[] { "node.exe", "offline-device.mjs", "NODE-LICENSE.txt", "dist/server.cjs", "dist/index.html" })
                {
                    if (archive.GetEntry(name) == null) return 1;
                }
                return archive.GetEntry("Install-CRM.cmd") == null ? 0 : 1;
            }
        }

        Console.OutputEncoding = System.Text.Encoding.UTF8;
        string stage = Path.Combine(Path.GetTempPath(), "MobilePartsCRM-" + Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(stage);
            using (ZipArchive archive = OpenPayload())
                archive.ExtractToDirectory(stage);

            var start = new ProcessStartInfo
            {
                FileName = Path.Combine(stage, "node.exe"),
                Arguments = "\"offline-device.mjs\" install --native-shortcut",
                WorkingDirectory = stage,
                UseShellExecute = false
            };
            using (Process setup = Process.Start(start))
            {
                setup.WaitForExit();
                if (setup.ExitCode != 0)
                    throw new InvalidOperationException("CRM o‘rnatilmadi. Yuqoridagi xabarni tekshiring.");
            }
            CreateDesktopShortcut();
            Console.WriteLine("Ish stolida Mobile Parts CRM yorlig‘i tayyor.");
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            Console.WriteLine("Yopish uchun Enter bosing.");
            Console.ReadLine();
            return 1;
        }
        finally
        {
            if (Directory.Exists(stage)) Directory.Delete(stage, true);
        }
    }

    private static ZipArchive OpenPayload()
    {
        Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(Payload);
        if (stream == null) throw new InvalidOperationException("CRM paketi topilmadi.");
        return new ZipArchive(stream, ZipArchiveMode.Read);
    }

    private static void CreateDesktopShortcut()
    {
        string target = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MobilePartsCRM");
        string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
        try
        {
            dynamic shortcut = shell.CreateShortcut(Path.Combine(desktop, "Mobile Parts CRM.lnk"));
            try
            {
                shortcut.TargetPath = Path.Combine(target, "node.exe");
                shortcut.Arguments = "\"offline-device.mjs\"";
                shortcut.WorkingDirectory = target;
                shortcut.WindowStyle = 7;
                shortcut.Save();
            }
            finally { Marshal.FinalReleaseComObject(shortcut); }
        }
        finally { Marshal.FinalReleaseComObject(shell); }
    }
}
