import _ from 'lodash';

//  Returns a random configuration of a module's timetable lessons.
//  Used when a module is first added.
export function randomLessonConfiguration(lessons) {
  return _(lessons)
    .groupBy('LessonType')
    .mapValues((group) => {
      return _.groupBy(group, 'ClassNo');
    })
    .mapValues((group) => {
      return _.sample(group);
    })
    .value();
}

//  Converts from timetable format to flat array of lessons.
//  {
//    [ModuleCode]: {
//      [LessonType]: [
//        { ...Lesson },
//        { ...Lesson },
//      ],
//      ...
//    }
//  }
export function timetableLessonsArray(timetable) {
  return _.flatMapDepth(timetable, (lessonType) => {
    return _.values(lessonType);
  }, 2);
}

//  Groups flat array of lessons by day.
//  {
//    Monday: [{ ...Lesson }, { ...Lesson }, ...],
//    Tuesday: [{ ...Lesson }, { ...Lesson }, ...]
//  }
export function groupLessonsByDay(lessons) {
  return _.groupBy(lessons, 'DayText');
}

//  Determines if two lessons of the same day overlap. Only start/end time is being checked
export function doLessonsOverlap(lesson1, lesson2) {
  return lesson1.StartTime < lesson2.EndTime && lesson2.StartTime < lesson1.EndTime;
}

//  Converts a flat array of lessons *within a day* into rows:
//  Result invariants:
//  - Each lesson will not overlap each other.
//  [
//    [{ ...Lesson }, { ...Lesson }, ...],
//    [{ ...Lesson }, ...],
//  ]
export function arrangeLessonsWithinDay(lessons) {
  const rows = [[]];
  if (_.isEmpty(lessons)) {
    return rows;
  }

  lessons.forEach((lesson) => {
    for (let i = 0, length = rows.length; i < length; i++) {
      const rowLessons = rows[i];
      // Search through lessons in row to look for available slots.
      const overlapTests = _.map(rowLessons, (rowLesson) => {
        return !doLessonsOverlap(rowLesson, lesson);
      });
      if (_.every(overlapTests)) {
        // Lesson does not overlap with any lessons in the row. Add it to row.
        rowLessons.push(lesson);
        return;
      }
    }
    rows.push([lesson]);
  });

  return rows;
}

export function arrangeLessonsForWeek(lessons) {
  const dayLessons = groupLessonsByDay(lessons);
  return _.mapValues(dayLessons, (dayLesson) => {
    return arrangeLessonsWithinDay(dayLesson);
  });
}
