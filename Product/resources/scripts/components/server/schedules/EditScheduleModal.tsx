import React, { useContext, useEffect, useState } from 'react';
import { Schedule } from '@/api/server/schedules/getServerSchedules';
import Field from '@/components/elements/Field';
import { Form, Formik, FormikHelpers, useFormikContext } from 'formik';
import FormikSwitch from '@/components/elements/FormikSwitch';
import createOrUpdateSchedule from '@/api/server/schedules/createOrUpdateSchedule';
import { ServerContext } from '@/state/server';
import { httpErrorToHuman } from '@/api/http';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import ModalContext from '@/context/ModalContext';
import asModal from '@/hoc/asModal';
import Switch from '@/components/elements/Switch';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';

interface Props {
    schedule?: Schedule;
}

interface Values {
    name: string;
    dayOfWeek: string;
    month: string;
    dayOfMonth: string;
    hour: string;
    minute: string;
    enabled: boolean;
    onlyWhenOnline: boolean;
}

interface IntervalState {
    days: { enabled: boolean; value: number };
    hours: { enabled: boolean; value: number };
    minutes: { enabled: boolean; value: number };
}

const parseIntervalFromCron = (cron: { minute: string; hour: string; dayOfMonth: string }): IntervalState | null => {
    const minuteMatch = cron.minute.match(/^\*\/(\d+)$/);
    const hourMatch = cron.hour.match(/^\*\/(\d+)$/);
    const dayMatch = cron.dayOfMonth.match(/^\*\/(\d+)$/);

    if (dayMatch && cron.minute === '0' && cron.hour === '0') {
        return {
            days: { enabled: true, value: parseInt(dayMatch[1]) },
            hours: { enabled: false, value: 1 },
            minutes: { enabled: false, value: 5 },
        };
    }

    if (hourMatch && cron.minute === '0' && !dayMatch) {
        return {
            days: { enabled: false, value: 1 },
            hours: { enabled: true, value: parseInt(hourMatch[1]) },
            minutes: { enabled: false, value: 5 },
        };
    }

    if (minuteMatch && !hourMatch && !dayMatch) {
        return {
            days: { enabled: false, value: 1 },
            hours: { enabled: false, value: 1 },
            minutes: { enabled: true, value: parseInt(minuteMatch[1]) },
        };
    }

    if (dayMatch) {
        return {
            days: { enabled: true, value: parseInt(dayMatch[1]) },
            hours: { enabled: false, value: 1 },
            minutes: { enabled: false, value: 5 },
        };
    }

    return null;
};

const buildCronFromInterval = (interval: IntervalState): Pick<Values, 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek'> => {
    if (interval.days.enabled) {
        return {
            minute: '0',
            hour: '0',
            dayOfMonth: `*/${interval.days.value}`,
            month: '*',
            dayOfWeek: '*',
        };
    }

    if (interval.hours.enabled) {
        return {
            minute: '0',
            hour: `*/${interval.hours.value}`,
            dayOfMonth: '*',
            month: '*',
            dayOfWeek: '*',
        };
    }

    if (interval.minutes.enabled) {
        return {
            minute: `*/${interval.minutes.value}`,
            hour: '*',
            dayOfMonth: '*',
            month: '*',
            dayOfWeek: '*',
        };
    }

    return {
        minute: '*/5',
        hour: '*',
        dayOfMonth: '*',
        month: '*',
        dayOfWeek: '*',
    };
};

const IntervalEditor = ({ interval, setInterval }: { interval: IntervalState; setInterval: (v: IntervalState) => void }) => {
    const { setFieldValue } = useFormikContext<Values>();

    const updateCronFromInterval = (newInterval: IntervalState) => {
        setInterval(newInterval);
        const cron = buildCronFromInterval(newInterval);
        setFieldValue('minute', cron.minute);
        setFieldValue('hour', cron.hour);
        setFieldValue('dayOfMonth', cron.dayOfMonth);
        setFieldValue('month', cron.month);
        setFieldValue('dayOfWeek', cron.dayOfWeek);
    };

    const toggleUnit = (unit: 'days' | 'hours' | 'minutes') => {
        const isEnabling = !interval[unit].enabled;

        let newInterval: IntervalState;

        if (isEnabling) {
            newInterval = {
                days: { ...interval.days, enabled: unit === 'days' },
                hours: { ...interval.hours, enabled: unit === 'hours' },
                minutes: { ...interval.minutes, enabled: unit === 'minutes' },
            };
        } else {
            newInterval = { ...interval, [unit]: { ...interval[unit], enabled: false } };
            if (!newInterval.days.enabled && !newInterval.hours.enabled && !newInterval.minutes.enabled) {
                newInterval.minutes.enabled = true;
            }
        }

        updateCronFromInterval(newInterval);
    };

    const updateValue = (unit: 'days' | 'hours' | 'minutes', value: number) => {
        const clampedValue = Math.max(1, Math.min(value, unit === 'minutes' ? 59 : unit === 'hours' ? 23 : 31));
        updateCronFromInterval({ ...interval, [unit]: { ...interval[unit], value: clampedValue } });
    };

    return (
        <div css={tw`space-y-3`}>
            {(['days', 'hours', 'minutes'] as const).map((unit) => (
                <div
                    key={unit}
                    css={tw`flex items-center gap-4 p-3 rounded-lg`}
                    style={{
                        backgroundColor: interval[unit].enabled ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-background-secondary)',
                        border: `1px solid ${interval[unit].enabled ? 'var(--color-primary)' : 'var(--color-neutral)'}`,
                        borderRadius: 'var(--border-radius, 8px)',
                        opacity: interval[unit].enabled ? 1 : 0.6,
                        transition: 'all 200ms ease',
                    }}
                >
                    <Input
                        type="checkbox"
                        checked={interval[unit].enabled}
                        onChange={() => toggleUnit(unit)}
                        css={tw`flex-shrink-0`}
                    />
                    <Label css={tw`flex-1 mb-0 capitalize cursor-pointer`} onClick={() => toggleUnit(unit)}>
                        {unit}
                    </Label>
                    <div css={tw`flex items-center gap-2`}>
                        <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Every</span>
                        <Input
                            type="number"
                            min={1}
                            max={unit === 'minutes' ? 59 : unit === 'hours' ? 23 : 31}
                            value={interval[unit].value}
                            onChange={(e) => updateValue(unit, parseInt(e.target.value) || 1)}
                            disabled={!interval[unit].enabled}
                            css={tw`w-16 text-center`}
                        />
                        <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem', minWidth: '60px' }}>
                            {unit === 'days' ? 'day(s)' : unit === 'hours' ? 'hour(s)' : 'minute(s)'}
                        </span>
                    </div>
                </div>
            ))}
            <p css={tw`text-xs mt-2`} style={{ color: 'var(--color-muted)' }}>
                Enable the time units you want to use. At least one must be selected.
            </p>
        </div>
    );
};

const EditScheduleModal = ({ schedule }: Props) => {
    const { addError, clearFlashes } = useFlash();
    const { dismiss } = useContext(ModalContext);

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const appendSchedule = ServerContext.useStoreActions((actions) => actions.schedules.appendSchedule);

    const existingCron = schedule?.cron || { minute: '*/5', hour: '*', dayOfMonth: '*' };
    const parsedInterval = parseIntervalFromCron(existingCron);
    
    const [useSimpleInterval, setUseSimpleInterval] = useState(!!parsedInterval);
    const [interval, setInterval] = useState<IntervalState>(
        parsedInterval || { days: { enabled: false, value: 1 }, hours: { enabled: false, value: 1 }, minutes: { enabled: true, value: 5 } }
    );

    useEffect(() => {
        return () => {
            clearFlashes('schedule:edit');
        };
    }, []);

    const submit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('schedule:edit');
        createOrUpdateSchedule(uuid, {
            id: schedule?.id,
            name: values.name,
            cron: {
                minute: values.minute,
                hour: values.hour,
                dayOfWeek: values.dayOfWeek,
                month: values.month,
                dayOfMonth: values.dayOfMonth,
            },
            onlyWhenOnline: values.onlyWhenOnline,
            isActive: values.enabled,
        })
            .then((schedule) => {
                setSubmitting(false);
                appendSchedule(schedule);
                dismiss();
            })
            .catch((error) => {
                console.error(error);

                setSubmitting(false);
                addError({ key: 'schedule:edit', message: httpErrorToHuman(error) });
            });
    };

    return (
        <Formik
            onSubmit={submit}
            initialValues={
                {
                    name: schedule?.name || '',
                    minute: schedule?.cron.minute || '*/5',
                    hour: schedule?.cron.hour || '*',
                    dayOfMonth: schedule?.cron.dayOfMonth || '*',
                    month: schedule?.cron.month || '*',
                    dayOfWeek: schedule?.cron.dayOfWeek || '*',
                    enabled: schedule?.isActive ?? true,
                    onlyWhenOnline: schedule?.onlyWhenOnline ?? true,
                } as Values
            }
        >
            {({ isSubmitting, setFieldValue }) => (
                <Form>
                    <h3 css={tw`text-2xl mb-6`}>{schedule ? 'Edit schedule' : 'Create new schedule'}</h3>
                    <FlashMessageRender byKey={'schedule:edit'} css={tw`mb-6`} />
                    <Field
                        name={'name'}
                        label={'Schedule name'}
                        description={'A human readable identifier for this schedule.'}
                    />
                    
                    <div 
                        className="mt-6 p-4 rounded-lg" 
                        style={{ 
                            backgroundColor: 'var(--color-background-secondary)', 
                            border: '1px solid var(--color-neutral)', 
                            borderRadius: 'var(--border-radius, 8px)' 
                        }}
                    >
                        <Switch
                            name="useSimpleInterval"
                            label="Simple Interval Mode"
                            description="Use a simplified interval picker instead of cron syntax."
                            defaultChecked={useSimpleInterval}
                            onChange={() => {
                                const newValue = !useSimpleInterval;
                                setUseSimpleInterval(newValue);
                                if (newValue) {
                                    const cron = buildCronFromInterval(interval);
                                    setFieldValue('minute', cron.minute);
                                    setFieldValue('hour', cron.hour);
                                    setFieldValue('dayOfMonth', cron.dayOfMonth);
                                    setFieldValue('month', cron.month);
                                    setFieldValue('dayOfWeek', cron.dayOfWeek);
                                }
                            }}
                        />
                    </div>

                    <div css={tw`mt-6`}>
                        {useSimpleInterval ? (
                            <IntervalEditor interval={interval} setInterval={setInterval} />
                        ) : (
                            <>
                                <div css={tw`grid grid-cols-2 sm:grid-cols-5 gap-4`}>
                                    <Field name={'minute'} label={'Minute'} />
                                    <Field name={'hour'} label={'Hour'} />
                                    <Field name={'dayOfMonth'} label={'Day of month'} />
                                    <Field name={'month'} label={'Month'} />
                                    <Field name={'dayOfWeek'} label={'Day of week'} />
                                </div>
                                <p css={tw`text-xs mt-2`} style={{ color: 'var(--color-muted)' }}>
                                    The schedule system supports the use of Cronjob syntax when defining when tasks should begin
                                    running. Use the fields above to specify when these tasks should begin running.
                                </p>
                            </>
                        )}
                    </div>

                    <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-neutral)', borderRadius: 'var(--border-radius, 8px)' }}>
                        <FormikSwitch
                            name={'onlyWhenOnline'}
                            description={'Only execute this schedule when the server is in a running state.'}
                            label={'Only When Server Is Online'}
                        />
                    </div>
                    <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-neutral)', borderRadius: 'var(--border-radius, 8px)' }}>
                        <FormikSwitch
                            name={'enabled'}
                            description={'This schedule will be executed automatically if enabled.'}
                            label={'Schedule Enabled'}
                        />
                    </div>
                    <div css={tw`mt-6 text-right`}>
                        <Button className={'w-full sm:w-auto'} type={'submit'} disabled={isSubmitting}>
                            {schedule ? 'Save changes' : 'Create schedule'}
                        </Button>
                    </div>
                </Form>
            )}
        </Formik>
    );
};

export default asModal<Props>()(EditScheduleModal);
