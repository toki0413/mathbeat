using System;
using System.IO;

class GCC {
    static void Main(string[] args) {
        string output = null;
        string input = null;
        for (int i = 0; i < args.Length; i++) {
            if (args[i] == "-E") continue;
            else if (args[i] == "-o") { output = args[++i]; continue; }
            else if (args[i].StartsWith("-I") || args[i].StartsWith("-D") || args[i] == "-xc") continue;
            else if (args[i].StartsWith("-")) continue;
            else if (args[i].EndsWith(".rc") || args[i].EndsWith(".h")) input = args[i];
        }
        if (input == null) {
            Console.Error.WriteLine("No input file");
            Environment.Exit(1);
        }
        if (output != null) File.Copy(input, output, true);
        else Console.WriteLine(File.ReadAllText(input));
    }
}
