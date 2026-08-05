import React, { useState } from 'react';
import { Schedule, Task } from '@/api/server/schedules/getServerSchedules';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowCircleDown,
    faClock,
    faCode,
    faFileArchive,
    faPencilAlt,
    faToggleOn,
    faTrashAlt,
} from '@fortawesome/free-solid-svg-icons';
import deleteScheduleTask from '@/api/server/schedules/deleteScheduleTask';
import { httpErrorToHuman } from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import TaskDetailsModal from '@/components/server/schedules/TaskDetailsModal';
import Can from '@/components/elements/Can';
import useFlash from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';
import tw from 'twin.macro';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import Icon from '@/components/elements/Icon';
import styled from 'styled-components/macro';

interface Props {
    schedule: Schedule;
    task: Task;
}

const getActionDetails = (action: string): [string, any] => {
    switch (action) {
        case 'command':
            return ['Send Command', faCode];
        case 'power':
            return ['Send Power Action', faToggleOn];
        case 'backup':
            return ['Create Backup', faFileArchive];
        default:
            return ['Unknown Action', faCode];
    }
};

const ActionButton = styled.button`
    ${tw`block text-sm p-2 transition-colors duration-150`};
    color: var(--color-inverted);

    &:hover {
        color: var(--color-base);
    }
`;

const DeleteButton = styled.button`
    ${tw`block text-sm p-2 transition-colors duration-150`};
    color: var(--color-inverted);

    &:hover {
        color: #ef4444;
    }
`;

export default ({ schedule, task }: Props) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { clearFlashes, addError } = useFlash();
    const [visible, setVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const appendSchedule = ServerContext.useStoreActions((actions) => actions.schedules.appendSchedule);

    const onConfirmDeletion = () => {
        setIsLoading(true);
        clearFlashes('schedules');
        deleteScheduleTask(uuid, schedule.id, task.id)
            .then(() =>
                appendSchedule({
                    ...schedule,
                    tasks: schedule.tasks.filter((t) => t.id !== task.id),
                })
            )
            .catch((error) => {
                console.error(error);
                setIsLoading(false);
                addError({ message: httpErrorToHuman(error), key: 'schedules' });
            });
    };

    const [title, icon] = getActionDetails(task.action);

    return (
        <div css={tw`sm:flex items-center p-3 sm:p-6`} style={{ borderBottom: '1px solid var(--color-neutral)' }}>
            <SpinnerOverlay visible={isLoading} fixed size={'large'} />
            <TaskDetailsModal
                schedule={schedule}
                task={task}
                visible={isEditing}
                onModalDismissed={() => setIsEditing(false)}
            />
            <ConfirmationModal
                title={'Confirm task deletion'}
                buttonText={'Delete Task'}
                onConfirmed={onConfirmDeletion}
                visible={visible}
                onModalDismissed={() => setVisible(false)}
            >
                Are you sure you want to delete this task? This action cannot be undone.
            </ConfirmationModal>
            <FontAwesomeIcon icon={icon} css={tw`text-lg hidden md:block`} style={{ color: 'var(--color-base)' }} />
            <div css={tw`flex-none sm:flex-1 w-full sm:w-auto overflow-x-auto`}>
                <p css={tw`md:ml-6 uppercase text-sm`} style={{ color: 'var(--color-muted)' }}>{title}</p>
                {task.payload && (
                    <div css={tw`md:ml-6 mt-2`}>
                        {task.action === 'backup' && (
                            <p css={tw`text-xs uppercase mb-1`} style={{ color: 'var(--color-inverted)' }}>Ignoring files & folders:</p>
                        )}
                        <div
                            css={tw`font-mono py-1 px-2 text-sm w-auto inline-block whitespace-pre-wrap break-all`}
                            style={{
                                backgroundColor: 'var(--color-background-secondary)',
                                color: 'var(--color-base)',
                                borderRadius: 'var(--border-radius, 8px)',
                                border: '1px solid var(--color-neutral)',
                            }}
                        >
                            {task.payload}
                        </div>
                    </div>
                )}
            </div>
            <div css={tw`mt-3 sm:mt-0 flex items-center w-full sm:w-auto`}>
                {task.continueOnFailure && (
                    <div css={tw`mr-6`}>
                        <div css={tw`flex items-center px-2 py-1 bg-yellow-500 text-yellow-800 text-sm rounded-full`}>
                            <Icon icon={faArrowCircleDown} css={tw`w-3 h-3 mr-2`} />
                            Continues on Failure
                        </div>
                    </div>
                )}
                {task.sequenceId > 1 && task.timeOffset > 0 && (
                    <div css={tw`mr-6`}>
                        <div
                            css={tw`flex items-center px-2 py-1 text-sm rounded-full`}
                            style={{ backgroundColor: 'var(--color-neutral)', color: 'var(--color-base)' }}
                        >
                            <Icon icon={faClock} css={tw`w-3 h-3 mr-2`} />
                            {task.timeOffset}s later
                        </div>
                    </div>
                )}
                <Can action={'schedule.update'}>
                    <ActionButton
                        type={'button'}
                        aria-label={'Edit scheduled task'}
                        css={tw`mr-4 ml-auto sm:ml-0`}
                        onClick={() => setIsEditing(true)}
                    >
                        <FontAwesomeIcon icon={faPencilAlt} />
                    </ActionButton>
                </Can>
                <Can action={'schedule.update'}>
                    <DeleteButton
                        type={'button'}
                        aria-label={'Delete scheduled task'}
                        onClick={() => setVisible(true)}
                    >
                        <FontAwesomeIcon icon={faTrashAlt} />
                    </DeleteButton>
                </Can>
            </div>
        </div>
    );
};
