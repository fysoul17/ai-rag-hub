#!/usr/bin/env python3
"""
PTY bridge: spawns a command in a real pseudo-terminal and relays I/O via
stdin/stdout pipes. This allows Bun.spawn() to communicate with CLI tools
that require a TTY (like `claude auth login`).

Usage: python3 pty-bridge.py <command> [args...]

The bridge:
  - Creates a PTY pair (master/slave)
  - Forks and runs the command in the child with the PTY as its terminal
  - Relays parent stdin -> PTY master (user input)
  - Relays PTY master -> parent stdout (command output)
  - Exits with the child's exit code
"""
import pty, os, sys, select, signal, errno

def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: pty-bridge.py <command> [args...]\n")
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[1:]  # argv[0] for execvp is the command name

    # Create PTY pair
    master_fd, slave_fd = pty.openpty()

    pid = os.fork()
    if pid == 0:
        # Child process: connect to slave PTY and exec the command
        os.close(master_fd)
        os.setsid()  # Create new session (detach from parent terminal)

        # Set slave as controlling terminal
        import fcntl, termios
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        if slave_fd > 2:
            os.close(slave_fd)

        # Set TERM for proper terminal behavior
        os.environ['TERM'] = 'xterm-256color'

        os.execvp(command, args)
        # If execvp fails
        sys.exit(127)
    else:
        # Parent process: relay I/O between pipes and PTY master
        os.close(slave_fd)

        # Make stdin non-blocking
        stdin_fd = sys.stdin.fileno()

        # Forward SIGWINCH (terminal resize) to child
        def handle_winch(signum, frame):
            os.kill(pid, signal.SIGWINCH)
        signal.signal(signal.SIGWINCH, handle_winch)

        # Relay loop
        try:
            while True:
                fds = [master_fd, stdin_fd]
                try:
                    r, _, _ = select.select(fds, [], [], 0.1)
                except (select.error, ValueError):
                    break

                if master_fd in r:
                    try:
                        data = os.read(master_fd, 4096)
                        if not data:
                            break
                        os.write(sys.stdout.fileno(), data)
                        sys.stdout.flush()
                    except OSError as e:
                        if e.errno == errno.EIO:
                            break  # PTY closed (child exited)
                        raise

                if stdin_fd in r:
                    try:
                        data = os.read(stdin_fd, 4096)
                        if not data:
                            # stdin closed — close master write side
                            break
                        os.write(master_fd, data)
                    except OSError:
                        break

                # Check if child is still alive
                try:
                    result = os.waitpid(pid, os.WNOHANG)
                    if result[0] != 0:
                        # Child exited, drain remaining output
                        while True:
                            try:
                                r, _, _ = select.select([master_fd], [], [], 0.1)
                                if r:
                                    data = os.read(master_fd, 4096)
                                    if not data:
                                        break
                                    os.write(sys.stdout.fileno(), data)
                                else:
                                    break
                            except OSError:
                                break
                        sys.stdout.flush()
                        os.close(master_fd)
                        sys.exit(os.WEXITSTATUS(result[1]) if os.WIFEXITED(result[1]) else 1)
                except ChildProcessError:
                    break

        except KeyboardInterrupt:
            os.kill(pid, signal.SIGTERM)
        finally:
            try:
                os.close(master_fd)
            except OSError:
                pass
            try:
                _, status = os.waitpid(pid, 0)
                sys.exit(os.WEXITSTATUS(status) if os.WIFEXITED(status) else 1)
            except ChildProcessError:
                sys.exit(0)

if __name__ == '__main__':
    main()
