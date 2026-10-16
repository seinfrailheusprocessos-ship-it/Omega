#!/bin/bash
# inicia/para o servidor de teste:  test/srv.sh start|stop  [porta]
S=/tmp/claude-0/-home-user-Omega/4509f1ec-d4e5-56fb-8705-e64f53ecd3fa/scratchpad
P=${2:-27190}
if [ -f $S/srv.pid ]; then kill $(cat $S/srv.pid) 2>/dev/null; rm -f $S/srv.pid; sleep 0.5; fi
if [ "$1" = "start" ]; then
  cd "$(dirname "$0")/.."
  nohup node src/server/standalone.js --root $S/cofre --data $S/srvdata --port $P --token TESTE123TESTE123TESTE123 > $S/srv.log 2>&1 &
  echo $! > $S/srv.pid
  sleep 1.5; cat $S/srv.log
fi
