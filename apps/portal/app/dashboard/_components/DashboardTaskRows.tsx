import type {DashboardPersonalTask} from '@/lib/dashboard/types';
import {TaskList,TaskRow} from '@/components/ui/foundation/FoundationOperational';
import dash from '../dashboard.module.css';
export default function DashboardTaskRows({tasks,readOnly,pendingTaskIds,toggleTask}:{tasks:DashboardPersonalTask[];readOnly:boolean;pendingTaskIds:ReadonlySet<string>;toggleTask:(task:DashboardPersonalTask,completed:boolean)=>Promise<void>}) {return (          <TaskList className={dash.taskList} ariaLabel="Personal tasks">
            {tasks.map((task) => {
              const completed = Boolean(task.completedAt);
              return (
                <TaskRow
                  key={task.id}
                  className={dash.taskBubble}
                  checked={completed}
                  disabled={readOnly||pendingTaskIds.has(task.id)}
                  label={task.title}
                  controlAriaLabel={`Complete ${task.title}`}
                  onChange={(checked) => void toggleTask(task, checked)}
                />
              );
            })}
          </TaskList>);}
